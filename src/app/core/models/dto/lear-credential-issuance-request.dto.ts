import { EmployeeMandatee, EmployeeMandator, Power, TmfAction } from "../entity/lear-credential";
import { DeliveryModeToken, HolderPublicJwk } from "../entity/lear-credential-issuance";

export type IssuanceGrantType = 'authorization_code' | 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export interface IssuanceLEARCredentialRequestDto {
    credential_configuration_id: string;
    payload: IssuanceLEARCredentialPayload;
    /** A single delivery mode: the Issuer answers a list with 400 `invalid_delivery_mode` (EUD-268). */
    delivery: DeliveryModeToken;
    email: string;
    grant_type: IssuanceGrantType;
    /**
     * The holder's public key, for the credential types whose schema declares no
     * `proof_types_supported` yet still bind to a holder key (EUD-168 AD-8). No wallet key proof
     * will ever arrive for those, so the request is the only source of one — in every delivery mode,
     * not just `direct`. Omitted for every other type, where the Issuer ignores it.
     *
     * The JWK itself, not wrapped in `{ "jwk": … }`: the Issuer answers the envelope with 400
     * `invalid_holder_key` (EUD-254 `design.md` AD-7, EUD-268).
     */
    holder_key?: HolderPublicJwk;
    /**
     * Organization the attestation is issued for, only on behalf of another organization (EUD-253
     * FR-07, action E2 -- tenant administrators only). Omitted, the Issuer files it under the caller's.
     */
    organization?: string;
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

/**
 * The one item of `responses[]`: the requested mode, delivered. A failed delivery never arrives
 * here -- the Issuer answers it as an RFC 9457 error (503 + `Retry-After`, or 500), which reaches
 * the `catchError` of the submit flow (EUD-268).
 */
export interface IssuanceChannelResponse {
    channel: IssuanceChannel;
    status: number;
    body?: IssuanceChannelBody;
}

/** Always 200 with exactly one entry in `responses[]`; no 207 since EUD-268. */
export interface IssuanceResponseDto {
    responses?: IssuanceChannelResponse[];
}