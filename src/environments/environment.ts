//this template is used for local serving ("ng serve") and testing

export const environment = {
  production: false,
  admin_organization_id: "VATES-000000000",
  client_id: 'vc-auth-client',
  iam_url: 'https://keycloak-dev.ssihub.org/realms/in2-issuer',
  server_url: 'http://localhost:8081',
  wallet_url: 'http://localhost:4202',
  wallet_url_test: 'http://localhost:4202',
  show_wallet_url_test: false,
};
