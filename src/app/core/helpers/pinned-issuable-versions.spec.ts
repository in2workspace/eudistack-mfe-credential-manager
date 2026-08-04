import {
  isPinnedIssuableVersion,
  keepPinnedIssuableVersions,
  PINNED_LATEST_VERSION_BY_LINEAGE
} from './pinned-issuable-versions';

describe('isPinnedIssuableVersion', () => {
  describe('pinned lineages', () => {
    it('should reject every employee w3c version below 4', () => {
      expect(isPinnedIssuableVersion('learcredential.employee.w3c.1')).toBe(false);
      expect(isPinnedIssuableVersion('learcredential.employee.w3c.2')).toBe(false);
      expect(isPinnedIssuableVersion('learcredential.employee.w3c.3')).toBe(false);
    });

    it('should accept the pinned employee w3c version and anything newer', () => {
      // Newer versions pass so a v5 published by the backend needs no change here.
      expect(isPinnedIssuableVersion('learcredential.employee.w3c.4')).toBe(true);
      expect(isPinnedIssuableVersion('learcredential.employee.w3c.5')).toBe(true);
      expect(isPinnedIssuableVersion('learcredential.employee.w3c.10')).toBe(true);
    });

    it('should reject every machine w3c version below 3 and accept 3 or newer', () => {
      expect(isPinnedIssuableVersion('learcredential.machine.w3c.1')).toBe(false);
      expect(isPinnedIssuableVersion('learcredential.machine.w3c.2')).toBe(false);
      expect(isPinnedIssuableVersion('learcredential.machine.w3c.3')).toBe(true);
      expect(isPinnedIssuableVersion('learcredential.machine.w3c.4')).toBe(true);
    });
  });

  describe('lineages that are not pinned', () => {
    it('should accept them at any version', () => {
      // A floor for known-legacy lineages, not an allowlist: a type added to the metadata
      // after this module was written must not silently disappear from the form.
      expect(isPinnedIssuableVersion('learcredential.employee.sd.1')).toBe(true);
      expect(isPinnedIssuableVersion('learcredential.employee.mdoc.1')).toBe(true);
      expect(isPinnedIssuableVersion('learcredential.machine.sd.1')).toBe(true);
      expect(isPinnedIssuableVersion('gx.labelcredential.w3c.1')).toBe(true);
      expect(isPinnedIssuableVersion('some.brand.new.type.w3c.1')).toBe(true);
    });

    it('should not let a pinned lineage constrain another sharing its type prefix', () => {
      // `learcredential.employee.w3c` is pinned; the sd lineage of the same type is not.
      expect(isPinnedIssuableVersion('learcredential.employee.sd.2')).toBe(true);
    });
  });

  describe('ids outside the version grammar', () => {
    it('should accept them, leaving the relative filter to drop them', () => {
      expect(isPinnedIssuableVersion('learcredential.employee.w3c')).toBe(true);
      expect(isPinnedIssuableVersion('LEARCredentialEmployee')).toBe(true);
      expect(isPinnedIssuableVersion('')).toBe(true);
    });
  });
});

describe('keepPinnedIssuableVersions', () => {
  it('should drop superseded versions and keep the rest in order', () => {
    const ids = [
      'learcredential.employee.w3c.1',
      'learcredential.employee.sd.1',
      'learcredential.employee.w3c.4',
      'learcredential.machine.w3c.2',
      'learcredential.machine.w3c.3'
    ];

    expect(keepPinnedIssuableVersions(ids, id => id)).toEqual([
      'learcredential.employee.sd.1',
      'learcredential.employee.w3c.4',
      'learcredential.machine.w3c.3'
    ]);
  });

  it('should read the id through the accessor', () => {
    const items = [
      { configId: 'learcredential.employee.w3c.1' },
      { configId: 'learcredential.employee.w3c.4' }
    ];

    expect(keepPinnedIssuableVersions(items, item => item.configId))
      .toEqual([{ configId: 'learcredential.employee.w3c.4' }]);
  });

  it('should return an empty list when every item is superseded', () => {
    const ids = ['learcredential.employee.w3c.3', 'learcredential.machine.w3c.1'];
    expect(keepPinnedIssuableVersions(ids, id => id)).toEqual([]);
  });

  it('should return an empty list for an empty input', () => {
    expect(keepPinnedIssuableVersions([], id => id)).toEqual([]);
  });
});

describe('PINNED_LATEST_VERSION_BY_LINEAGE', () => {
  it('should pin the lineages that have legacy versions in the wild', () => {
    expect(PINNED_LATEST_VERSION_BY_LINEAGE).toEqual({
      'learcredential.employee.w3c': 4,
      'learcredential.machine.w3c': 3
    });
  });
});
