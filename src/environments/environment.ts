//this template is used for local serving ("ng serve") and testing

export const environment = {
  production: false,
  client_id_prefix: 'vc-auth-client-',
  client_id: 'vc-auth-client',
  iam_url: 'https://keycloak-dev.ssihub.org/realms/in2-issuer',
  server_url: 'http://localhost:8081',
  /**
   * Clock-skew tolerance (seconds) for the id_token `iat` claim, passed to
   * angular-auth-oidc-client as `maxIdTokenIatOffsetAllowedInSeconds`. The
   * library default is 120s; a device or IdP clock a couple of minutes out
   * then fails the login callback with no recoverable path. 300s keeps the
   * OIDC replay-window check meaningful (spec §C8: "the acceptable range is
   * Client specific") while tolerating realistic NTP drift.
   */
  max_id_token_iat_offset_seconds: 300
};
