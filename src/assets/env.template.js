(function(window) {
  window.env = window.env || {};

  // Tenant is resolved in-app (TenantService); no need to compute it here.

  // OIDC Client ID: tenant is resolved at runtime
  window["env"]["client_id_prefix"] = "${CLIENT_ID_PREFIX}";
  // Empty by design: client_id_prefix selects the tenant-specific client.
  window["env"]["client_id"] = "";

  // Empty by design: TenantService resolves the same-origin or custom-domain verifier.
  window["env"]["iam_url"] = "";

  // Issuer API: relative path (same origin, no CORS)
  window["env"]["server_url"] = "${SERVER_URL}";

  // Wallet deeplinks are derived at runtime from window.location.origin in-app.
  window["env"]["show_wallet_url_test"] = "${SHOW_WALLET_URL_TEST}";
})(this);
