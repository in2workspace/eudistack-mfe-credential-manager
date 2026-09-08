// this template is used for deployment in all environments (LCL, SBX, Dev2 and PRD)

export const environment = {
  production: true,
  client_id_prefix: window["env"]["client_id_prefix"],
  // OIDC client identifier — resolved per tenant at runtime (REQUIRED)
  client_id: window["env"]["client_id"],
  // Keycloak URL (REQUIRED)
  iam_url: window["env"]["iam_url"],
  // Issuer API base URL (REQUIRED)
  server_url: window["env"]["server_url"],
  // Clock-skew tolerance (s) for the id_token `iat` check (OPTIONAL).
  // Defaults to 300 when unset in the deploy env — see environment.ts for the rationale.
  max_id_token_iat_offset_seconds: Number(window["env"]["max_id_token_iat_offset_seconds"]) || 300
};
