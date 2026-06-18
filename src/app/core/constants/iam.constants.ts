export const IAM_PARAMS = Object.freeze({
    CLIENT_ID: "vc-auth-client",
    SCOPE: "openid profile email offline_access learcredential role",
    GRANT_TYPE: "code"
});

const baseHref = document.querySelector('base')?.getAttribute('href') || '/';
// no cal canviar-ho, serà issuer.dome-marketplace-lcl.org/issuer
export const IAM_POST_LOGOUT_URI = `${globalThis.location.origin}${baseHref}`;
// crec q no cal canviar-ho, en qualsevol cas no és crític
export const IAM_POST_LOGIN_ROUTE = '/organization/credentials';
// ídem, issuer.dome-marketplace-lcl.org/issuer va bé
export const IAM_REDIRECT_URI = `${globalThis.location.origin}${baseHref}`;