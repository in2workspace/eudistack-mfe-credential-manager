//this template is used for local serving ("ng serve") and testing

export const environment = {
  production: false,
  client_id_prefix: 'vc-auth-client-',
  client_id: 'vc-auth-client',
  iam_url: 'https://keycloak-dev.ssihub.org/realms/in2-issuer',
  server_url: 'http://localhost:8081',
  /**
   * Clock-skew tolerance (seconds) for the id_token `iat` claim, passed to
   * angular-auth-oidc-client as `maxIdTokenIatOffsetAllowedInSeconds`. Kept at
   * the library default (120s); made explicit so it can be tuned per
   * deployment via `window.env.max_id_token_iat_offset_seconds` without a code
   * change if an environment shows clock drift.
   */
  max_id_token_iat_offset_seconds: 120
};
