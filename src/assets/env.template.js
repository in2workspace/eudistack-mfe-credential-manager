(function(window) {
  window.env = window.env || {};

  // Atlassian-style: tenant = first segment of hostname
  // e.g. kpmg.eudistack.net → kpmg, kpmg.127.0.0.1.nip.io → kpmg
  const tenant = window.location.hostname.split(".")[0];

  // OIDC Client ID: tenant is resolved at runtime
  window["env"]["client_id_prefix"] = "${CLIENT_ID_PREFIX}";
  // Allows to overwrite the client_id (use in case the client_id is by environment, not by tenant)
  window["env"]["client_id"] = "${CLIENT_ID}";

  // IAM URL: OIDC authority (Verifier as IdP) — same origin + /verifier path
  window["env"]["iam_url"] = window.location.origin + "/verifier";

  // Issuer API: relative path (same origin, no CORS)
  window["env"]["server_url"] = "${SERVER_URL}";

  // Wallet deeplinks are derived at runtime from window.location.origin in-app.
  window["env"]["show_wallet_url_test"] = "${SHOW_WALLET_URL_TEST}";
})(this);
