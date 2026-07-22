export const IAM_PARAMS = Object.freeze({
    CLIENT_ID: "vc-auth-client",
    SCOPE: "openid profile email offline_access learcredential role",
    GRANT_TYPE: "code"
});

const baseHref = document.querySelector('base')?.getAttribute('href') || '/';
export const IAM_POST_LOGOUT_URI = `${globalThis.location.origin}${baseHref}`;
export const IAM_POST_LOGIN_ROUTE = '/organization/credentials';
export const IAM_REDIRECT_URI = `${globalThis.location.origin}${baseHref}`;

/**
 * Public routes that must remain reachable without an authenticated session.
 * On these, AuthService skips the silent-SSO redirect (trySilentSsoOnce) so an
 * unauthenticated visitor is not bounced to the dashboard / login.
 *
 * Matched with `startsWith` against `location.pathname` (anchored, not a
 * substring match). Because `location.pathname` includes the app baseHref
 * (`/issuer/...`), both the app-relative and the `/issuer`-prefixed variants
 * are listed.
 *
 * Keep in sync with the auth-guard-free routes in `app.routes.ts`
 * (currently `credential-offer` and `credential-offer-refresh/:token`).
 */
export const PUBLIC_ROUTE_PREFIXES = [
  '/credential-offer',
  '/credential-offer-refresh',
  '/issuer/credential-offer',
  '/issuer/credential-offer-refresh',
] as const;
