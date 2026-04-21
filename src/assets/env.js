(function(window) {
  window.env = window.env || {};

  // Environment variables
  window["env"]["iam_url"] = "${IAM_URL}";
  window["env"]["client_id"] = "${CLIENT_ID}";
  window["env"]["server_url"] = "${SERVER_URL}";
  window["env"]["wallet_url"] = "${WALLET_URL}";
  window["env"]["wallet_url_test"] = "${WALLET_URL_TEST}";
  window["env"]["show_wallet_url_test"] = "${SHOW_WALLET_URL_TEST}";
})(this);
