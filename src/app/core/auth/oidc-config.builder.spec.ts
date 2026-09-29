import { environment } from 'src/environments/environment';
import { buildOidcConfig } from './oidc-config.builder';

describe('buildOidcConfig', () => {
  it('includes client_id in customParamsEndSessionRequest, matching the computed clientId, for a canonical tenant', () => {
    const config = buildOidcConfig('sandbox', 'https://sandbox.example.com/issuer', 'https://sandbox.example.com/verifier', true);

    expect(config.customParamsEndSessionRequest).toEqual({ client_id: config.clientId });
    expect(config.clientId).toBe(`${environment.client_id_prefix}sandbox`);
  });

  it('includes client_id in customParamsEndSessionRequest, matching the computed clientId, for a non-canonical (custom domain) tenant', () => {
    const config = buildOidcConfig('sandbox', 'https://custom.example.com/issuer', 'https://custom.example.com/verifier', false);

    expect(config.customParamsEndSessionRequest).toEqual({ client_id: config.clientId });
    expect(config.clientId).toBe(`${environment.client_id_prefix}sandbox-custom`);
  });

  it('requests the learcredential scope, not a dedicated one, so no client registration is needed', () => {
    const config = buildOidcConfig('sandbox', 'https://sandbox.example.com/issuer', 'https://sandbox.example.com/verifier', true);

    expect(config.scope).toContain('learcredential');
    expect(config.scope).not.toContain('issuer_access');
  });

  it('sends access_profile=issuer_access on every authorization request', () => {
    const config = buildOidcConfig('sandbox', 'https://sandbox.example.com/issuer', 'https://sandbox.example.com/verifier', true);

    expect(config.customParamsAuthRequest).toEqual({ access_profile: 'issuer_access' });
  });
});
