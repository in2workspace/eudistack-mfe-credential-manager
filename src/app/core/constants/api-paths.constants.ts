//todo why API and API_PATH?
export const API_PATH = Object.freeze({
    CREDENTIAL_OFFER: '/oid4vci/v1/credential-offer',
    CONFIGURATION: '/issuance/v1/configuration',
    NOTIFICATION: '/issuance/v1/notifications',
    PROCEDURES: '/issuance/v1/issuances',
    REVOKE: '/w3c/v1/credentials/status/revoke',
    SAVE_CREDENTIAL: '/v1/issuances',
    SIGN_CREDENTIAL: '/issuance/v1/retry-sign-credential',
    CREDENTIAL_ISSUER_METADATA: '/.well-known/openid-credential-issuer'
});
