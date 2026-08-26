import { DeliveryCsv, HolderPublicJwk } from "../entity/lear-credential-issuance";
import { EmployeeMandatee, EmployeeMandator, Power, TmfAction } from "../entity/lear-credential";

export type IssuanceGrantType = 'authorization_code' | 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export interface IssuanceLEARCredentialRequestDto {
    credential_configuration_id: string;
    payload: IssuanceLEARCredentialPayload;
    /** CSV of the selected delivery modes; only `toDeliveryCsv()` produces one. */
    delivery: DeliveryCsv;
    email: string;
    grant_type: IssuanceGrantType;
    holder_key?: { jwk: HolderPublicJwk };
}

export type IssuanceLEARCredentialPayload = IssuanceLEARCredentialMachinePayload | IssuanceLEARCredentialEmployeePayload;

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
        // Omitted when no key was generated locally (wallet-only delivery): the backend then
        // injects the proof-derived did:key.
        id?: string, //did-key
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

export interface IssuanceDeliveryResultDto {
    mode: string;
    status: string;
    error?: string;
}

export interface IssuanceResponseDto {
    credential_offer_uri?: string;
    signed_credential?: string;
    delivery_results?: IssuanceDeliveryResultDto[];
}