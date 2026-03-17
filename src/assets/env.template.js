(function(window) {
  window.env = window.env || {};

  // IAM URL: derive from current hostname so each tenant subdomain
  // (e.g. cgcom.127.0.0.1.nip.io) points to its own verifier.
  // Falls back to a static value when IAM_URI_TEMPLATE is not set.
  const iamTemplate = "${IAM_URI_TEMPLATE}";
  if (iamTemplate?.includes("{host}")) {
    // Template provided (e.g. "https://{host}:4444") — replace {host} with current hostname
    window["env"]["iam_url"] = iamTemplate.replace("{host}", window.location.hostname);
  } else {
    // Static fallback (legacy / non-nip.io environments)
    window["env"]["iam_url"] = "${IAM_URL}";
  }

  // OIDC Client ID: derive from tenant subdomain so each tenant uses
  // its own registered client (e.g. vc-auth-client-altia, vc-auth-client-dome).
  // Falls back to a static value when CLIENT_ID_PREFIX is not set.
  const clientIdPrefix = "${CLIENT_ID_PREFIX}";
  if (clientIdPrefix) {
    const tenant = window.location.hostname.split(".")[0];
    window["env"]["client_id"] = clientIdPrefix + tenant;
  } else {
    window["env"]["client_id"] = "${CLIENT_ID}";
  }

  window["env"]["server_url"] = "${BASE_URL}";
  window["env"]["admin_organization_id"]= "${ADMIN_ORGANIZATION_ID}"
  window["env"]["wallet_url"] = "${WALLET_URL}";
  window["env"]["wallet_url_test"] = "${WALLET_URL_TEST}";
  window["env"]["show_wallet_url_test"] = "${SHOW_WALLET_URL_TEST}";
})(this);
