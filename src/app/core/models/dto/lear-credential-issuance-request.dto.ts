import { HolderPublicJwk } from "../entity/lear-credential-issuance";
import { EmployeeMandatee, EmployeeMandator, Power, TmfAction } from "../entity/lear-credential";

/**
 * CSV of delivery modes, e.g. `email` or `direct,email` — the Operator can pick more than one.
 * Build it with `toDeliveryCsv()` so the order is always canonical.
 */
export type IssuanceDelivery = string;

export type IssuanceGrantType = 'authorization_code' | 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export interface IssuanceLEARCredentialRequestDto {
    credential_configuration_id: string;
    payload: IssuanceLEARCredentialPayload;
    delivery: IssuanceDelivery;
    email: string;
    grant_type: IssuanceGrantType;
    /**
     * Holder key for credential types that bind to one without a wallet proof. Only sent when
     * `direct` is among the delivery modes: with `email`/`ui` alone the cnf comes from the
     * wallet's OID4VCI proof, and the backend fills `mandatee.id` from it.
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
        // Omitted when no key was generated locally (wallet-only delivery): the backend then
        // injects the proof-derived did:key (GenericCredentialBuilder.bindHolderDid).
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
    /** The signed credential itself. Only returned when `direct` is among the delivery modes. */
    signed_credential?: string;
    delivery_results?: IssuanceDeliveryResultDto[];
}