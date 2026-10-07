import { LEAR_ISSUANCE_POLICY_REASONS, resolveIssuanceBusinessError, toMandatorOrganizationId } from './issuance-error.helpers';

// Jest resolves JSON modules natively; the spec tsconfig has no node typings nor resolveJsonModule.
declare const require: (id: string) => any;

describe('issuance-error.helpers', () => {

  describe('resolveIssuanceBusinessError', () => {
    it('resolves a known LEAR issuance policy reason on a 403 insufficient_permission', () => {
      const error = { status: 403, error: { type: 'insufficient_permission', reason: 'onboarding_delegation_same_org', detail: 'x' } };

      expect(resolveIssuanceBusinessError(error)).toEqual({ kind: 'policy', reason: 'onboarding_delegation_same_org' });
    });

    it.each([
      ['an unknown reason', { status: 403, error: { type: 'insufficient_permission', reason: 'something_else' } }],
      ['no reason at all (e.g. configuration not allowed for the tenant, ES-02)', { status: 403, error: { type: 'insufficient_permission', detail: 'not allowed for tenant acme' } }],
      ['a reason on another status', { status: 409, error: { type: 'insufficient_permission', reason: 'onboarding_delegation_same_org' } }],
      ['a reason under another type', { status: 403, error: { type: 'tenant_mismatch', reason: 'onboarding_delegation_same_org' } }],
      ['a 500', { status: 500, error: { type: 'INTERNAL_SERVER_ERROR' } }],
      ['a timeout (no body)', { name: 'TimeoutError' }],
      ['null', null],
    ])('falls back to the generic message for %s', (_label, error) => {
      expect(resolveIssuanceBusinessError(error)).toBeNull();
    });

    it('resolves the rejected fields of a 400 payload_validation_error, de-duplicated and without array indexes', () => {
      const error = {
        status: 400,
        error: {
          type: 'payload_validation_error',
          violations: [
            { field: '$.mandatee.email', message: 'does not match the email pattern' },
            { field: '$.mandator.organizationIdentifier', message: 'is missing' },
            { field: '$.power[0].action', message: 'must have at least 1 item' },
            { field: '$.power[1].action', message: 'must have at least 1 item' },
            { field: '$', message: 'required property missing' }
          ]
        }
      };

      expect(resolveIssuanceBusinessError(error)).toEqual({
        kind: 'validation',
        fields: [
          { group: 'mandatee', field: 'email' },
          { group: 'mandator', field: 'organizationIdentifier' },
          { group: 'power', field: 'action' }
        ]
      });
    });

    it('falls back when a payload validation carries no usable field', () => {
      expect(resolveIssuanceBusinessError({ status: 400, error: { type: 'payload_validation_error', violations: [{ field: '$' }] } })).toBeNull();
      expect(resolveIssuanceBusinessError({ status: 400, error: { type: 'invalid_request' } })).toBeNull();
    });
  });

  describe('LEAR_ISSUANCE_POLICY_REASONS', () => {
    // Mirrors LearIssuancePolicyException.Reason in eudistack-core-issuer: update both sides together.
    it('matches the reason codes the Issuer exposes', () => {
      expect([...LEAR_ISSUANCE_POLICY_REASONS].sort()).toEqual([
        'certification_delegation_requires_multi_org',
        'certification_delegation_requires_tenant_admin',
        'mandator_organization_missing',
        'on_behalf_requires_multi_org',
        'on_behalf_requires_tenant_admin',
        'onboarding_delegation_requires_multi_org',
        'onboarding_delegation_requires_tenant_admin',
        'onboarding_delegation_same_org',
        'operator_lacks_onboarding',
      ]);
    });

    it.each(['en', 'es', 'ca'])('has a %s translation for every reason', lang => {
      const bundle = require(`../../../../assets/i18n/${lang}.json`);
      const reasons = bundle.credentialIssuance['create-error-dialog'].reasons;

      for (const reason of LEAR_ISSUANCE_POLICY_REASONS) {
        expect(reasons[reason]).toEqual(expect.any(String));
      }
    });
  });

  describe('toMandatorOrganizationId', () => {
    it('prefixes VAT + country like the request factory does', () => {
      expect(toMandatorOrganizationId('ES', 'A15456585')).toBe('VATES-A15456585');
    });

    it('keeps an identifier that already carries the VAT prefix', () => {
      expect(toMandatorOrganizationId('ES', 'VATES-A15456585')).toBe('VATES-A15456585');
    });

    it('returns null while the identifier or the country is not filled in', () => {
      expect(toMandatorOrganizationId('ES', '')).toBeNull();
      expect(toMandatorOrganizationId(null, 'A15456585')).toBeNull();
    });
  });
});
