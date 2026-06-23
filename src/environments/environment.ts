//this template is used for local serving ("ng serve") and testing

export const environment = {
  production: false,
  client_id_prefix: 'vc-auth-client-',
  client_id: 'vc-auth-client',
  iam_url: 'https://keycloak-dev.ssihub.org/realms/in2-issuer',
  server_url: 'http://localhost:8081',
};
