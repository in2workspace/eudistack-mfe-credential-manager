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

export type IssuanceChannel = 'direct' | 'ui' | 'email';

export interface IssuanceChannelBody {
    signed_credential?: string;
    credential_offer_uri?: string;
}

/** RFC 9457 Problem Details, scoped to one channel (EUD-167 D-6). */
export interface IssuanceChannelError {
    type: string;
    title: string;
    status: number;
    detail: string;
}

/**
 * One item of `responses[]` (EUD-167 D-5/D-6): `body` on success (`status: 200`) or `error` on
 * failure (`status: 503`, or `504` for a timed-out wallet leg) -- never both.
 */
export interface IssuanceChannelResponse {
    channel: IssuanceChannel;
    status: number;
    body?: IssuanceChannelBody;
    error?: IssuanceChannelError;
}

export interface IssuanceResponseDto {
    responses?: IssuanceChannelResponse[];
}