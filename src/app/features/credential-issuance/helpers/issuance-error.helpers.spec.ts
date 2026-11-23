import { ISSUANCE_REJECTION_TYPES, LEAR_ISSUANCE_POLICY_REASONS, resolveIssuanceBusinessError, toMandatorOrganizationId } from './issuance-error.helpers';

// Jest resolves JSON modules natively; the spec tsconfig has no node typings nor resolveJsonModule.
declare const require: (id: string) => any;

describe('issuance-error.helpers', () => {

  describe('resolveIssuanceBusinessError', () => {
    it('resolves a known LEAR issuance policy reason on a 403 insufficient_permission', () => {
      const error = { status: 403, error: { type: 'insufficient_permission', reason: 'on_behalf_requires_tenant_admin', detail: 'x' } };

      expect(resolveIssuanceBusinessError(error)).toEqual({ kind: 'policy', reason: 'on_behalf_requires_tenant_admin' });
    });

    it.each([
      ['an unknown reason', { status: 403, error: { type: 'insufficient_permission', reason: 'something_else' } }],
      ['no reason at all (e.g. configuration not allowed for the tenant, ES-02)', { status: 403, error: { type: 'insufficient_permission', detail: 'not allowed for tenant acme' } }],
      ['a reason on another status', { status: 409, error: { type: 'insufficient_permission', reason: 'on_behalf_requires_tenant_admin' } }],
      ['a reason under another type', { status: 403, error: { type: 'tenant_mismatch', reason: 'on_behalf_requires_tenant_admin' } }],
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

    it.each(['unsupported_credential_type', 'unknown_organization'])('resolves a 400 %s as a rejection (EUD-268)', type => {
      expect(resolveIssuanceBusinessError({ status: 400, error: { type, detail: 'x' } })).toEqual({ kind: 'rejection', type });
    });

    it('no longer resolves the retired 403 credential_type_not_enabled reason (EUD-268: now a 400)', () => {
      const error = { status: 403, error: { type: 'insufficient_permission', reason: 'credential_type_not_enabled' } };

      expect(resolveIssuanceBusinessError(error)).toBeNull();
    });

    it.each(['signing_failed', 'status_list_unavailable', 'wallet_delivery_timeout'])(
      'resolves a 503 %s as a retryable delivery failure', type => {
        expect(resolveIssuanceBusinessError({ status: 503, error: { type } })).toEqual({ kind: 'delivery', retryable: true });
      });

    it.each(['delivery_failed', 'persistence_failed'])('resolves a 500 %s as a final delivery failure', type => {
      expect(resolveIssuanceBusinessError({ status: 500, error: { type } })).toEqual({ kind: 'delivery', retryable: false });
    });

    it.each([
      ['a rejection type on another status', { status: 403, error: { type: 'unknown_organization' } }],
      ['a retryable delivery type on a 500', { status: 500, error: { type: 'signing_failed' } }],
      ['a final delivery type on a 503', { status: 503, error: { type: 'delivery_failed' } }],
      ['a 503 with no known type', { status: 503, error: { type: 'service_unavailable' } }],
    ])('falls back to the generic message for %s', (_label, error) => {
      expect(resolveIssuanceBusinessError(error)).toBeNull();
    });
  });

  describe('LEAR_ISSUANCE_POLICY_REASONS', () => {
    // Mirrors LearIssuancePolicyException.Reason in eudistack-core-issuer: update both sides together.
    it('matches the reason codes the Issuer exposes', () => {
      expect([...LEAR_ISSUANCE_POLICY_REASONS].sort()).toEqual([
        'authorization_rule_missing',
        'certification_delegation_requires_tenant_admin',
        'certification_power_required',
        'foreign_domain_delegation_requires_platform_admin',
        'on_behalf_requires_tenant_admin',
        'onboarding_delegation_requires_tenant_admin',
        'operator_lacks_onboarding',
        'platform_tenant_read_only',
        'tenant_admin_delegation_requires_platform_admin',
      ]);
    });

    it.each(['en', 'es', 'ca'])('has a %s translation for every reason', lang => {
      const bundle = require(`../../../../assets/i18n/${lang}.json`);
      const reasons = bundle.credentialIssuance['create-error-dialog'].reasons;

      for (const reason of LEAR_ISSUANCE_POLICY_REASONS) {
        expect(reasons[reason]).toEqual(expect.any(String));
      }
      expect(reasons['credential_type_not_enabled']).toBeUndefined();
    });

    it.each(['en', 'es', 'ca'])('has a %s translation for every rejection and delivery outcome', lang => {
      const dialog = require(`../../../../assets/i18n/${lang}.json`).credentialIssuance['create-error-dialog'];

      for (const type of ISSUANCE_REJECTION_TYPES) {
        expect(dialog.rejections[type]).toEqual(expect.any(String));
      }
      expect(dialog.delivery.retryable).toEqual(expect.any(String));
      expect(dialog.delivery.final).toEqual(expect.any(String));
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
