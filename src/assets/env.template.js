(function(window) {
  window.env = window.env || {};

  // Tenant is resolved in-app (TenantService); no need to compute it here.

  // OIDC Client ID: tenant is resolved at runtime
  window["env"]["client_id_prefix"] = "${CLIENT_ID_PREFIX}";
  // Allows to overwrite the client_id (use in case the client_id is by environment, not by tenant)
  window["env"]["client_id"] = "${CLIENT_ID}";

  // IAM URL: OIDC authority (Verifier as IdP) — same origin + /verifier path
  window["env"]["iam_url"] = "${IAM_URL}";

  // Issuer API: relative path (same origin, no CORS)
  window["env"]["server_url"] = "${SERVER_URL}";

  // Wallet deeplinks are derived at runtime from window.location.origin in-app.
  window["env"]["show_wallet_url_test"] = "${SHOW_WALLET_URL_TEST}";
})(this);
