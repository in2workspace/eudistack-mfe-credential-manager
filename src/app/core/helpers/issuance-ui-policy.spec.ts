import {
  parseIssuanceUiPolicyDocument,
  policyAllowsConfiguration,
} from './issuance-ui-policy';

const EMPLOYEE_W3C = 'learcredential.employee.w3c.4';
const EMPLOYEE_SD = 'learcredential.employee.sd.1';
const MACHINE_W3C = 'learcredential.machine.w3c.3';

const DEFAULT_ENTRY = ['learcredential.employee.w3c', 'learcredential.employee.sd', 'learcredential.machine.w3c'];

const documentWith = (extra: Record<string, unknown>) => ({
  default: { allowedCredentials: [...DEFAULT_ENTRY] },
  ...extra,
});

describe('parseIssuanceUiPolicyDocument', () => {
  describe('tenant resolution', () => {
    it('prefers the tenant entry over the default', () => {
      const doc = documentWith({ tenants: { kpmg: { allowedCredentials: ['learcredential.employee.sd'] } } });

      expect(parseIssuanceUiPolicyDocument(doc, 'kpmg')).toEqual({
        allowedCredentials: ['learcredential.employee.sd'],
      });
    });

    it('falls back to the default for a tenant with no entry', () => {
      const doc = documentWith({ tenants: { kpmg: { allowedCredentials: ['learcredential.employee.sd'] } } });

      expect(parseIssuanceUiPolicyDocument(doc, 'dome')).toEqual({ allowedCredentials: DEFAULT_ENTRY });
    });

    it('falls back to the default when the tenant is unresolved', () => {
      const doc = documentWith({ tenants: { kpmg: { allowedCredentials: [] } } });

      expect(parseIssuanceUiPolicyDocument(doc, '')).toEqual({ allowedCredentials: DEFAULT_ENTRY });
    });

    // An explicit empty list is a policy ("this tenant issues through the API only"), not a
    // missing one: it must neither inherit the default nor read as a broken document.
    it('honours an empty tenant list instead of inheriting the default', () => {
      const doc = documentWith({ tenants: { kpmg: { allowedCredentials: [] } } });

      expect(parseIssuanceUiPolicyDocument(doc, 'kpmg')).toEqual({ allowedCredentials: [] });
    });

    it('returns null when neither the tenant entry nor a default is usable', () => {
      expect(parseIssuanceUiPolicyDocument({}, 'kpmg')).toBeNull();
      expect(parseIssuanceUiPolicyDocument({ tenants: { kpmg: {} } }, 'kpmg')).toBeNull();
    });
  });

  describe('malformed input', () => {
    it.each([null, undefined, 42, 'a string', ['an array']])('returns null for %p', input => {
      expect(parseIssuanceUiPolicyDocument(input, 'kpmg')).toBeNull();
    });

    it('returns null when allowedCredentials is not an array', () => {
      expect(parseIssuanceUiPolicyDocument({ default: { allowedCredentials: 'a.b' } }, 'kpmg')).toBeNull();
    });

    it('ignores an unusable tenants map and reads the default', () => {
      expect(parseIssuanceUiPolicyDocument(documentWith({ tenants: 'not-a-map' }), 'kpmg')).toEqual({
        allowedCredentials: DEFAULT_ENTRY,
      });
    });

    it('drops non-string, blank and duplicate entries rather than the whole policy', () => {
      const doc = {
        default: {
          allowedCredentials: [
            ' learcredential.employee.w3c ',
            '',
            '   ',
            42,
            null,
            'learcredential.employee.w3c',
            'learcredential.machine.w3c',
          ],
        },
      };

      expect(parseIssuanceUiPolicyDocument(doc, 'kpmg')).toEqual({
        allowedCredentials: ['learcredential.employee.w3c', 'learcredential.machine.w3c'],
      });
    });

    // Declared-but-all-invalid is someone's broken document, and must fail closed with an
    // explanation rather than pass as "this tenant issues nothing".
    it('returns null when entries were declared but none survived normalization', () => {
      expect(parseIssuanceUiPolicyDocument({ default: { allowedCredentials: ['', '  ', 7] } }, 'kpmg')).toBeNull();
    });
  });
});

describe('policyAllowsConfiguration', () => {
  const policyOf = (...allowedCredentials: string[]) => ({ allowedCredentials });

  it('matches every version of an allowed type+format', () => {
    const policy = policyOf('learcredential.employee.w3c');

    expect(policyAllowsConfiguration(policy, 'learcredential.employee.w3c.1')).toBe(true);
    expect(policyAllowsConfiguration(policy, EMPLOYEE_W3C)).toBe(true);
  });

  // The format is part of the identity of what is allowed, so allowing one says nothing
  // about the others.
  it('does not extend an allowed type to its other formats', () => {
    const policy = policyOf('learcredential.employee.w3c');

    expect(policyAllowsConfiguration(policy, EMPLOYEE_SD)).toBe(false);
    expect(policyAllowsConfiguration(policy, MACHINE_W3C)).toBe(false);
  });

  it('allows several lineages independently', () => {
    const policy = policyOf('learcredential.employee.w3c', 'learcredential.employee.sd');

    expect(policyAllowsConfiguration(policy, EMPLOYEE_W3C)).toBe(true);
    expect(policyAllowsConfiguration(policy, EMPLOYEE_SD)).toBe(true);
    expect(policyAllowsConfiguration(policy, MACHINE_W3C)).toBe(false);
  });

  // Lineage equality, not a prefix test: a bare type is not a lineage, and a longer id is a
  // different lineage.
  it('matches on the whole lineage and nothing else', () => {
    expect(policyAllowsConfiguration(policyOf('learcredential.employee'), EMPLOYEE_W3C)).toBe(false);
    expect(policyAllowsConfiguration(policyOf('learcredential.employee.w3c'), 'learcredential.employee.w3c.extra.1')).toBe(false);
    expect(policyAllowsConfiguration(policyOf('learcredential.employee.w3c'), 'learcredential.employeecopy.w3c.1')).toBe(false);
  });

  it('never allows an id with no version', () => {
    expect(policyAllowsConfiguration(policyOf('learcredential.employee.w3c'), 'learcredential.employee.w3c')).toBe(false);
    expect(policyAllowsConfiguration(policyOf('LEAR_CREDENTIAL_EMPLOYEE'), 'LEAR_CREDENTIAL_EMPLOYEE')).toBe(false);
  });

  it('allows nothing under an empty policy', () => {
    expect(policyAllowsConfiguration(policyOf(), EMPLOYEE_W3C)).toBe(false);
  });
});
