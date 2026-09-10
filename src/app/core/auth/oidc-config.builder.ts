import { OpenIdConfiguration } from 'angular-auth-oidc-client';
import { environment } from 'src/environments/environment';
import {
  IAM_PARAMS,
  IAM_POST_LOGIN_ROUTE,
  IAM_POST_LOGOUT_URI,
  IAM_REDIRECT_URI,
} from '../constants/iam.constants';

export function buildOidcConfig(tenant: string, serverUrl: string, iamUrl: string, canonical: boolean): OpenIdConfiguration {
  if (environment.client_id_prefix && !tenant) {
    throw new Error('Cannot build OIDC config because tenant could not be resolved.');
  }

  const customSuffix = canonical ? '' : '-custom';
  const clientIdPrefix = environment.client_id_prefix;
  const clientId = clientIdPrefix
    ? `${clientIdPrefix}${tenant}${customSuffix}`
    : `${environment.client_id}${customSuffix}`;

  return {
    logLevel: 1,
    postLoginRoute: IAM_POST_LOGIN_ROUTE,
    authority: iamUrl,
    redirectUrl: IAM_REDIRECT_URI,
    postLogoutRedirectUri: IAM_POST_LOGOUT_URI,
    clientId,
    scope: IAM_PARAMS.SCOPE,
    responseType: IAM_PARAMS.GRANT_TYPE,
    silentRenew: true,
    useRefreshToken: true,
    historyCleanupOff: false,
    ignoreNonceAfterRefresh: true,
    triggerRefreshWhenIdTokenExpired: false,
    autoUserInfo: false,
    // Clock-skew tolerance for the id_token `iat` check (library default 120s).
    // Set from environment.max_id_token_iat_offset_seconds (300s) so a device or
    // IdP clock a few minutes out doesn't get its token rejected on the login
    // callback — which used to surface as a silent redirect to /home. The OIDC
    // replay-window check stays ON: `disableIatOffsetValidation` is unset.
    maxIdTokenIatOffsetAllowedInSeconds: environment.max_id_token_iat_offset_seconds,
    secureRoutes: [serverUrl || '/'].filter((r): r is string => !!r),
  };
}
