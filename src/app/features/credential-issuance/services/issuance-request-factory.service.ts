import { inject, Injectable } from '@angular/core';
import { IssuancePayloadPower, IssuanceLEARCredentialEmployeePayload, IssuanceLEARCredentialPayload, IssuanceLEARCredentialMachinePayload, IssuanceLEARCredentialRequestDto, IssuanceGrantType } from 'src/app/core/models/dto/lear-credential-issuance-request.dto';
import { EmployeeMandatee, TmfAction, TmfFunction } from 'src/app/core/models/entity/lear-credential';
import { DeliveryMode, HolderKeyMaterial, IssuanceCredentialType, IssuanceRawCredentialPayload, IssuanceRawPowerForm, toDeliveryCsv } from 'src/app/core/models/entity/lear-credential-issuance';
import { AuthService } from 'src/app/core/services/auth.service';
import { ThemeService } from 'src/app/core/services/theme.service';

@Injectable({
  providedIn: 'root'
})
export class IssuanceRequestFactoryService {

  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  private readonly credentialRequestFactoryMap: Record<IssuanceCredentialType, (credData: IssuanceRawCredentialPayload, holderKey?: HolderKeyMaterial) => IssuanceLEARCredentialPayload> = {
    'learcredential.employee': (data) => this.createLearCredentialEmployeeRequest(data),
    'learcredential.machine': (data, holderKey) => this.createLearCredentialMachineRequest(data, holderKey)
  }

  /**
   * @param deliveryModes the modes the Operator selected; serialised to the CSV the backend
   *                  expects here, so no caller has to build (or mis-build) that string.
   * @param holderKey generated during submission when the selected configuration requires one
   *                  (`cnf_required` and no cryptographic binding method), for every delivery
   *                  mode alike. It supplies both `mandatee.id` (did:key) and `holder_key.jwk`.
   *                  Absent for wallet-bound types, where the backend derives both from the proof.
   */
  public createCredentialRequest(
      credentialData: IssuanceRawCredentialPayload,
      credentialType: IssuanceCredentialType,
      configId: string,
      deliveryModes: readonly DeliveryMode[] = ['email'],
      grantType: IssuanceGrantType = 'authorization_code',
      holderKey?: HolderKeyMaterial
  ): IssuanceLEARCredentialRequestDto {
        const payload = this.createCredentialRequestPayload(credentialData, credentialType, holderKey);
        const email = this.getCredentialEmail(credentialData, credentialType);
        return this.buildRequestDto(configId, deliveryModes, payload, email, grantType, holderKey);
      }

  public createCredentialRequestPayload(
      credentialData: IssuanceRawCredentialPayload,
      credentialType: IssuanceCredentialType,
      holderKey?: HolderKeyMaterial
    ): IssuanceLEARCredentialPayload{

     return this.credentialRequestFactoryMap[credentialType](credentialData, holderKey);
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

  private createLearCredentialMachineRequest(credentialData: IssuanceRawCredentialPayload, holderKey?: HolderKeyMaterial): IssuanceLEARCredentialMachinePayload{
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
          // Only when a key was generated locally (direct delivery). Left out otherwise so the
          // backend can inject the proof-derived did:key instead of finding a blank already there.
          ...(holderKey ? { id: holderKey.didKey } : {}),
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
      if (credentialType === 'learcredential.machine') {
        return credentialData.formData['mandator']?.['email'] ?? '';
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
      const base = buildPowerMap(this.themeService.tenantDomain)[credType]?.[tmfFunc];

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

  private buildRequestDto(configId: string, deliveryModes: readonly DeliveryMode[], payload: IssuanceLEARCredentialPayload, email: string, grantType: IssuanceGrantType, holderKey?: HolderKeyMaterial): IssuanceLEARCredentialRequestDto {
    return {
      credential_configuration_id: configId,
      payload,
      delivery: toDeliveryCsv(deliveryModes),
      email,
      grant_type: grantType,
      // Only the public half travels. The private key never leaves the browser.
      ...(holderKey ? { holder_key: { jwk: holderKey.publicJwk } } : {})
    };
  }
}

function buildPowerMap(tenantDomain: string): Record<IssuanceCredentialType, Partial<Record<TmfFunction, IssuancePayloadPower>>> {
  const powerBase = {
    type: "domain" as const,
    domain: tenantDomain
  };

  return {
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
      },
      'ProductOffering': {
        ...powerBase,
        function: 'ProductOffering',
        action: ['Create', 'Update', 'Delete']
      },
      'Certification': {
        ...powerBase,
        function: 'Certification',
        action: ['Attest', 'Upload']
      }
    },
  };
}