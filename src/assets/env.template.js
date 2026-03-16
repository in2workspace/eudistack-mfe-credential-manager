(function(window) {
  window.env = window.env || {};

  // Environment variables
  //todo external env var has to be changed in Helm
  window["env"]["iam_url"] = "${IAM_URL}";
  window["env"]["server_url"] = "${BASE_URL}";
  window["env"]["admin_organization_id"]= "${ADMIN_ORGANIZATION_ID}"
  window["env"]["wallet_url"] = "${WALLET_URL}";
  window["env"]["wallet_url_test"] = "${WALLET_URL_TEST}";
  window["env"]["show_wallet_url_test"] = "${SHOW_WALLET_URL_TEST}";
})(this);
