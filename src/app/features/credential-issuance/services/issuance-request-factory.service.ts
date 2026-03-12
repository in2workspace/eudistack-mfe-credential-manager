import { inject, Injectable } from '@angular/core';
import { IssuancePayloadPower, IssuanceLEARCredentialEmployeePayload, IssuanceLEARCredentialPayload, IssuanceLEARCredentialMachinePayload, IssuanceLEARCredentialRequestDto, IssuanceDelivery, IssuanceGrantType } from 'src/app/core/models/dto/lear-credential-issuance-request.dto';
import { EmployeeMandatee, TmfAction, TmfFunction } from 'src/app/core/models/entity/lear-credential';
import { IssuanceCredentialType, IssuanceRawCredentialPayload, IssuanceRawPowerForm } from 'src/app/core/models/entity/lear-credential-issuance';
import { AuthService } from 'src/app/core/services/auth.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class IssuanceRequestFactoryService {

  private readonly authService = inject(AuthService);

  private readonly credentialRequestFactoryMap: Record<IssuanceCredentialType, (credData: IssuanceRawCredentialPayload) => IssuanceLEARCredentialPayload> = {
    'learcredential.employee': (data) => this.createLearCredentialEmployeeRequest(data),
    'learcredential.machine': (data) => this.createLearCredentialMachineRequest(data)
  }

  public createCredentialRequest(
      credentialData: IssuanceRawCredentialPayload,
      credentialType: IssuanceCredentialType,
      configId: string,
      delivery: IssuanceDelivery = 'email',
      grantType: IssuanceGrantType = 'authorization_code'
  ): IssuanceLEARCredentialRequestDto {
        const payload = this.createCredentialRequestPayload(credentialData, credentialType);
        const email = this.getCredentialEmail(credentialData, credentialType);
        return this.buildRequestDto(configId, delivery, payload, email, grantType);
      }

  public createCredentialRequestPayload(
      credentialData: IssuanceRawCredentialPayload, 
      credentialType: IssuanceCredentialType
    ): IssuanceLEARCredentialPayload{

     return this.credentialRequestFactoryMap[credentialType](credentialData);
    }

  private createLearCredentialEmployeeRequest(credentialData: IssuanceRawCredentialPayload): IssuanceLEARCredentialEmployeePayload{
    // Power
    const parsedPower = this.parsePower(credentialData.formData['power'], 'learcredential.employee');

    // Mandatee
    const mandatee = this.getMandateeFromCredentialData(credentialData) as unknown as EmployeeMandatee;
    
    // Mandator
    const mandator = this.getMandatorFromCredentialData(credentialData);
    if(!mandator){
      console.error('Error getting mandator.'); 
      return {} as IssuanceLEARCredentialEmployeePayload;
    }
    const country = mandator['country'];
    const orgIdSuffix = mandator['organizationIdentifier'];
    const orgId = this.createOrganizationId(country, orgIdSuffix);
    const mandatorId = this.createDidElsi(orgId);
    const mandatorCommonName = mandator['commonName'] ?? this.formatCommonName(mandator['firstName'], mandator['lastName']);

    // Payload
    const payload: IssuanceLEARCredentialEmployeePayload =    
      {
      mandator: {
            id: mandatorId,
            email: mandator['email'],
            organization: mandator['organization'],
            country:  country,
            commonName:  mandatorCommonName,
            serialNumber:  mandator['serialNumber'],
            organizationIdentifier: orgId
        },
        mandatee: {
            ...mandatee
        },
        power: parsedPower
      }
      return payload;
  }

  private createLearCredentialMachineRequest(credentialData: IssuanceRawCredentialPayload): IssuanceLEARCredentialMachinePayload{
    // Power
    const parsedPower = this.parsePower(credentialData.formData['power'], 'learcredential.machine');

    // Mandatee
    const mandatee = this.getMandateeFromCredentialData(credentialData);

    // Mandator
    const mandator = this.getMandatorFromCredentialData(credentialData);
    if(!mandator){
      console.error('Error getting mandator.');
      return {} as IssuanceLEARCredentialMachinePayload;
    }
    const country = mandator['country'];
    const orgIdSuffix = mandator['organizationIdentifier'];
    const orgId = this.createOrganizationId(country, orgIdSuffix);
    const mandatorId = this.createDidElsi(orgId);
    const mandatorCommonName = mandator['commonName'] ?? this.formatCommonName(mandator['firstName'], mandator['lastName']);
    const mandatorEmail = mandator['email'];

    const didKey = credentialData.formData['keys']['didKey'];
    
    // Payload
    const payload: IssuanceLEARCredentialMachinePayload =    
      {
      mandator: {
        commonName:  mandatorCommonName,
        serialNumber:  mandator['serialNumber'],
        email: mandatorEmail, 
        organization: mandator['organization'],
        id: mandatorId,
        organizationIdentifier: orgId,
        country:  mandator['country'],
      },
      mandatee: {
          id:  didKey,
          domain:  mandatee['domain'],
          ipAddress:  mandatee["ipAddress"]
      },
      power: parsedPower
    }
    return payload;
  }

  private getCredentialEmail(credentialData: IssuanceRawCredentialPayload,
    credentialType: IssuanceCredentialType): string {
      if (credentialType === 'learcredential.employee') {
        return credentialData.formData['mandatee']?.['email'] ?? '';
      }
      if (!credentialData.onBehalf) {
        return this.authService.getMandateeEmail();
      }
      return credentialData.formData['mandatee']?.['email'] ?? '';
  }

  private createDidElsi(orgId: string): string{
    return "did:elsi:" + orgId;
  }

  private createOrganizationId(country: string, orgIdSuffix: string): string{
    const hasVAT = this.checkIfHasVAT(orgIdSuffix);
    return  hasVAT ? orgIdSuffix : ("VAT" + country + '-' + orgIdSuffix);
  }

  private checkIfHasVAT(orgId: string){
    const regex = /^VAT..-/;
    return regex.test(orgId);
  }

  private formatCommonName(name: string, lastName: string): string{
    return name + ' ' + lastName;
  }

  private parsePower(
    power: IssuanceRawPowerForm,
    credType: IssuanceCredentialType
  ): IssuancePayloadPower[] {
    return Object.entries(power).reduce<IssuancePayloadPower[]>((acc, [funct, pow]) => {
      const tmfFunc = funct as TmfFunction;
      const base = powerMap[credType]?.[tmfFunc];

      if (!base) {
        console.error('Function key found in schema but not in received data: ' + funct);
        return acc;
      }
      
      const selectedActions = (Object.entries(pow) as [TmfAction, boolean][])
        .filter(([_, enabled]) => enabled)
        .map(([action]) => action);

      if (selectedActions.length === 0) {
        console.error('Not actions found for this key: ' + funct);
        return acc;
      }

      const parsed: IssuancePayloadPower = {
        ...base,
        action: selectedActions
      };

      return [...acc, parsed];
    }, []);
  }

private getMandatorFromCredentialData(credentialData: IssuanceRawCredentialPayload): Record<string, string>{
  if(!credentialData.onBehalf){
    const unparsedMandator = credentialData.staticData?.mandator;
    if(!unparsedMandator) throw new Error('Could not get valid mandator on behalf');
    return Object.fromEntries(unparsedMandator.map(item => [item.key, item.value]));
  }
  return credentialData.formData['mandator'];
}
    
private getMandateeFromCredentialData(credentialData: IssuanceRawCredentialPayload): Record<string, string>{
  return this.stripNullValues(credentialData.formData['mandatee']);
}

private stripNullValues(obj: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  ) as Record<string, string>;
}

  private buildRequestDto(configId: string, delivery: IssuanceDelivery, payload: IssuanceLEARCredentialPayload, email: string, grantType: IssuanceGrantType): IssuanceLEARCredentialRequestDto {
    return {
      credential_configuration_id: configId,
      payload,
      delivery,
      email,
      grant_type: grantType
    };
  }
}

const powerBase = {
  type: "domain",
  domain: environment.sys_tenant
}

const powerMap: Record<IssuanceCredentialType, Partial<Record<TmfFunction, IssuancePayloadPower>>> = {
      'learcredential.employee': {
        'Onboarding': {
          ...powerBase,
          function: 'Onboarding',
          action: ['Execute']
        },
        'ProductOffering': {
          ...powerBase,
          function: 'ProductOffering',
          action: ['Create', 'Update', 'Upload']
        },
        'Certification': {
          ...powerBase,
          function: 'Certification',
          action: ['Attest', 'Upload']
        }
      },
      'learcredential.machine': {
          'Onboarding': {
            ...powerBase,
            function: 'Onboarding',
            action: ['Execute']
          }
      },
    }