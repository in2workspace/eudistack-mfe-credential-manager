export const IAM_PARAMS = Object.freeze({
    CLIENT_ID: "vc-auth-client",
    SCOPE: "openid profile email offline_access learcredential role",
    GRANT_TYPE: "code"
});

const baseHref = document.querySelector('base')?.getAttribute('href') || '/';
export const IAM_POST_LOGOUT_URI = `${globalThis.location.origin}${baseHref}`;
export const IAM_POST_LOGIN_ROUTE = '/organization/credentials';
export const IAM_REDIRECT_URI = `${globalThis.location.origin}${baseHref}`;