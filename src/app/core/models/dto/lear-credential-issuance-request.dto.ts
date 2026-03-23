import { EmployeeMandatee, EmployeeMandator, Power, TmfAction } from "../entity/lear-credential";

export type IssuanceDelivery = 'email' | 'ui';

export type IssuanceGrantType = 'authorization_code' | 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export interface IssuanceLEARCredentialRequestDto {
    credential_configuration_id: string;
    payload: IssuanceLEARCredentialPayload;
    delivery: IssuanceDelivery;
    email: string;
    grant_type: IssuanceGrantType;
}

export type IssuanceLEARCredentialPayload = IssuanceLEARCredentialMachinePayload | IssuanceLEARCredentialEmployeePayload | IssuanceDoctorIdPayload;

//interfaces enviades a API
export interface IssuancePayloadPower extends Power {
    action: TmfAction[]
}


//it should probably be the same as in credential details, but details feature/interface has to be updated first
export interface IssuanceLEARCredentialMachinePayload {
    mandator: {
        id: string, //did-elsi
        organizationIdentifier: string,
        commonName: string,
        email: string,
        serialNumber: string
        organization: string,
        country: string,
    },
    mandatee: {
        id: string, //did-key
        domain: string,
        ipAddress: string
    },
    power: IssuancePayloadPower[]
}

export interface IssuanceLEARCredentialEmployeePayload {
      mandatee: EmployeeMandatee;
      mandator: EmployeeMandator;
      power: IssuancePayloadPower[];
}

export interface IssuanceDoctorIdPayload {
    firstName: string;
    lastName: string;
    registrationNumber: string;
    nationalId: string;
    provincialBoard: string;
    specialty: string;
    email: string;
    country: string;
}

export interface IssuanceResponseDto {
    credential_offer_uri?: string;
}