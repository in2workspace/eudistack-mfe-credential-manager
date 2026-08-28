import { EmployeeMandatee, EmployeeMandator, Power, TmfAction } from "../entity/lear-credential";
import { HolderPublicJwk } from "../entity/lear-credential-issuance";

export type IssuanceDelivery = 'email' | 'ui';

export type IssuanceGrantType = 'authorization_code' | 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export interface IssuanceLEARCredentialRequestDto {
    credential_configuration_id: string;
    payload: IssuanceLEARCredentialPayload;
    delivery: IssuanceDelivery;
    email: string;
    grant_type: IssuanceGrantType;
    /**
     * The holder's public key, for the credential types whose schema declares no
     * `proof_types_supported` yet still bind to a holder key (EUD-168 AD-8). No wallet key proof
     * will ever arrive for those, so the request is the only source of one — in every delivery mode,
     * not just `direct`. Omitted for every other type, where the Issuer ignores it.
     */
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

export interface IssuanceResponseDto {
    credential_offer_uri?: string;
}