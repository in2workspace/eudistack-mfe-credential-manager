import {
  filterCredentialConfigurationsForTenant,
  isCredentialTypeVisibleForTenant
} from './credential-type-visibility';

const EMPLOYEE = 'learcredential.employee.w3c.2';
const MACHINE = 'learcredential.machine.w3c.1';
const DOCTOR_ID = 'doctorid.sd.1';
const LABEL = 'gx.labelcredential.w3c.2';

describe('isCredentialTypeVisibleForTenant', () => {
  describe('unrestricted tenants', () => {
    for (const tenant of ['sandbox', 'platform']) {
      it(`should show every type to ${tenant}`, () => {
        expect(isCredentialTypeVisibleForTenant(EMPLOYEE, tenant)).toBe(true);
        expect(isCredentialTypeVisibleForTenant(DOCTOR_ID, tenant)).toBe(true);
        expect(isCredentialTypeVisibleForTenant(LABEL, tenant)).toBe(true);
      });
    }
  });

  describe('doctor id', () => {
    it('should be visible to cgcom', () => {
      expect(isCredentialTypeVisibleForTenant(DOCTOR_ID, 'cgcom')).toBe(true);
    });

    it('should be hidden from every other restricted tenant', () => {
      for (const tenant of ['dome', 'kpmg', 'eudistack', 'calidalia', 'localhost']) {
        expect(isCredentialTypeVisibleForTenant(DOCTOR_ID, tenant)).toBe(false);
      }
    });
  });

  describe('gaia-x label', () => {
    it('should be visible to dome', () => {
      expect(isCredentialTypeVisibleForTenant(LABEL, 'dome')).toBe(true);
    });

    it('should be hidden from every other restricted tenant', () => {
      for (const tenant of ['cgcom', 'kpmg', 'eudistack', 'calidalia', 'localhost']) {
        expect(isCredentialTypeVisibleForTenant(LABEL, tenant)).toBe(false);
      }
    });

    it('should apply to every version and format of the type', () => {
      expect(isCredentialTypeVisibleForTenant('gx.labelcredential.w3c.1', 'cgcom')).toBe(false);
      expect(isCredentialTypeVisibleForTenant('gx.labelcredential.sd.7', 'cgcom')).toBe(false);
      expect(isCredentialTypeVisibleForTenant('gx.labelcredential.sd.7', 'dome')).toBe(true);
    });
  });

  describe('unrestricted types', () => {
    it('should be visible to every tenant', () => {
      for (const tenant of ['dome', 'cgcom', 'kpmg', 'eudistack', 'calidalia', 'localhost']) {
        expect(isCredentialTypeVisibleForTenant(EMPLOYEE, tenant)).toBe(true);
        expect(isCredentialTypeVisibleForTenant(MACHINE, tenant)).toBe(true);
      }
    });

    // Restrictions are opt-in: a type the map does not mention must not disappear.
    it('should be visible even when the type is unknown to the UI', () => {
      expect(isCredentialTypeVisibleForTenant('brandnew.credential.w3c.1', 'kpmg')).toBe(true);
    });
  });

  describe('tenant resolution failures', () => {
    // Fail closed: no tenant is not a reason to leak another organization's type.
    it('should hide restricted types when the tenant is empty or unknown', () => {
      for (const tenant of ['', 'not-a-tenant']) {
        expect(isCredentialTypeVisibleForTenant(DOCTOR_ID, tenant)).toBe(false);
        expect(isCredentialTypeVisibleForTenant(LABEL, tenant)).toBe(false);
      }
    });

    it('should still show unrestricted types when the tenant is empty', () => {
      expect(isCredentialTypeVisibleForTenant(EMPLOYEE, '')).toBe(true);
    });
  });

  describe('segment-boundary matching', () => {
    // A bare startsWith('doctorid') would catch this one too.
    it('should not restrict a different type sharing a prefix', () => {
      expect(isCredentialTypeVisibleForTenant('doctoridentity.sd.1', 'kpmg')).toBe(true);
      expect(isCredentialTypeVisibleForTenant('gx.labelcredentialextra.w3c.1', 'kpmg')).toBe(true);
    });

    it('should restrict a sub-type of a restricted type', () => {
      expect(isCredentialTypeVisibleForTenant('doctorid.specialist.sd.1', 'kpmg')).toBe(false);
      expect(isCredentialTypeVisibleForTenant('doctorid.specialist.sd.1', 'cgcom')).toBe(true);
    });

    it('should match an unparseable id against the map as-is', () => {
      expect(isCredentialTypeVisibleForTenant('doctorid', 'kpmg')).toBe(false);
      expect(isCredentialTypeVisibleForTenant('doctorid', 'cgcom')).toBe(true);
      expect(isCredentialTypeVisibleForTenant('LEAR_CREDENTIAL_EMPLOYEE', 'kpmg')).toBe(true);
    });
  });
});

describe('filterCredentialConfigurationsForTenant', () => {
  interface Entry { credentialConfigurationId: string }
  const entries: Entry[] = [EMPLOYEE, MACHINE, DOCTOR_ID, LABEL]
    .map(credentialConfigurationId => ({ credentialConfigurationId }));

  const idsFor = (tenant: string): string[] =>
    filterCredentialConfigurationsForTenant(entries, e => e.credentialConfigurationId, tenant)
      .map(e => e.credentialConfigurationId);

  it('should keep everything for an unrestricted tenant', () => {
    expect(idsFor('sandbox')).toEqual([EMPLOYEE, MACHINE, DOCTOR_ID, LABEL]);
    expect(idsFor('platform')).toEqual([EMPLOYEE, MACHINE, DOCTOR_ID, LABEL]);
  });

  it('should keep doctor id only for cgcom', () => {
    expect(idsFor('cgcom')).toEqual([EMPLOYEE, MACHINE, DOCTOR_ID]);
  });

  it('should keep the label only for dome', () => {
    expect(idsFor('dome')).toEqual([EMPLOYEE, MACHINE, LABEL]);
  });

  it('should drop both restricted types for any other tenant', () => {
    expect(idsFor('kpmg')).toEqual([EMPLOYEE, MACHINE]);
    expect(idsFor('calidalia')).toEqual([EMPLOYEE, MACHINE]);
  });

  it('should preserve the input order', () => {
    const reordered = [LABEL, EMPLOYEE, MACHINE].map(credentialConfigurationId => ({ credentialConfigurationId }));
    const result = filterCredentialConfigurationsForTenant(reordered, e => e.credentialConfigurationId, 'dome');
    expect(result.map(e => e.credentialConfigurationId)).toEqual([LABEL, EMPLOYEE, MACHINE]);
  });

  it('should return the original item references', () => {
    const result = filterCredentialConfigurationsForTenant(entries, e => e.credentialConfigurationId, 'dome');
    expect(result[0]).toBe(entries[0]);
  });

  it('should not mutate the input', () => {
    filterCredentialConfigurationsForTenant(entries, e => e.credentialConfigurationId, 'kpmg');
    expect(entries.length).toBe(4);
  });

  it('should return an empty list when every type is restricted away', () => {
    const restrictedOnly = [DOCTOR_ID, LABEL].map(credentialConfigurationId => ({ credentialConfigurationId }));
    const result = filterCredentialConfigurationsForTenant(restrictedOnly, e => e.credentialConfigurationId, 'kpmg');
    expect(result).toEqual([]);
  });
});
