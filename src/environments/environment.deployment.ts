// this template is used for deployment in all environments (LCL, SBX, Dev2 and PRD)

export const environment = {
  production: true,
  // OIDC client identifier — resolved per tenant at runtime (REQUIRED)
  client_id: window["env"]["client_id"],
  // Keycloak URL (REQUIRED)
  iam_url: window["env"]["iam_url"],
  // Issuer API base URL (REQUIRED)
  server_url: window["env"]["server_url"],
  // Determines whether to show the wallet "test" deeplink alongside the PRD one (REQUIRED)
  show_wallet_url_test: window["env"]["show_wallet_url_test"] === "true",
};
