import {
  keepLatestCredentialConfigurationIds,
  keepLatestCredentialConfigurations,
  parseCredentialConfigurationId
} from './credential-configuration-id';

describe('parseCredentialConfigurationId', () => {
  it('should split a configuration id into lineage, format family and version', () => {
    expect(parseCredentialConfigurationId('learcredential.employee.w3c.2')).toEqual({
      id: 'learcredential.employee.w3c.2',
      lineage: 'learcredential.employee.w3c',
      formatFamily: 'w3c',
      version: 2
    });
  });

  it('should read only the last segment as the version', () => {
    // The type prefix itself may contain digits; only the trailing segment is the version.
    expect(parseCredentialConfigurationId('gx.labelcredential.w3c.1')?.lineage).toBe('gx.labelcredential.w3c');
    expect(parseCredentialConfigurationId('some.type.2.w3c.10')).toEqual({
      id: 'some.type.2.w3c.10',
      lineage: 'some.type.2.w3c',
      formatFamily: 'w3c',
      version: 10
    });
  });

  it('should report the format segment as the format family', () => {
    expect(parseCredentialConfigurationId('learcredential.employee.sd.1')?.formatFamily).toBe('sd');
    expect(parseCredentialConfigurationId('gx.labelcredential.w3c.1')?.formatFamily).toBe('w3c');
  });

  it('should report the only lineage segment as the family for a degenerate id', () => {
    expect(parseCredentialConfigurationId('foo.1')).toEqual({
      id: 'foo.1',
      lineage: 'foo',
      formatFamily: 'foo',
      version: 1
    });
  });

  it('should return null when there is no trailing version', () => {
    expect(parseCredentialConfigurationId('learcredential.employee.w3c')).toBeNull();
    expect(parseCredentialConfigurationId('learcredential.employee')).toBeNull();
    expect(parseCredentialConfigurationId('LEAR_CREDENTIAL_EMPLOYEE')).toBeNull();
    expect(parseCredentialConfigurationId('')).toBeNull();
  });

  it('should reject anything but plain digits as a version', () => {
    // A loose Number() parse would turn these into 2, 1000 and 0 respectively.
    expect(parseCredentialConfigurationId('learcredential.employee.w3c. 2 ')).toBeNull();
    expect(parseCredentialConfigurationId('learcredential.employee.w3c.1e3')).toBeNull();
    expect(parseCredentialConfigurationId('learcredential.employee.w3c.')).toBeNull();
    expect(parseCredentialConfigurationId('learcredential.employee.w3c.v2')).toBeNull();
    expect(parseCredentialConfigurationId('learcredential.employee.w3c.-1')).toBeNull();
  });

  it('should require a lineage in front of the version', () => {
    expect(parseCredentialConfigurationId('2')).toBeNull();
  });
});

describe('keepLatestCredentialConfigurationIds', () => {
  it('should keep only the highest version of a lineage', () => {
    expect(keepLatestCredentialConfigurationIds([
      'learcredential.employee.w3c.1',
      'learcredential.employee.w3c.2'
    ])).toEqual(['learcredential.employee.w3c.2']);
  });

  it('should keep the highest version regardless of input order', () => {
    expect(keepLatestCredentialConfigurationIds([
      'learcredential.employee.w3c.4',
      'learcredential.employee.w3c.1',
      'learcredential.employee.w3c.3'
    ])).toEqual(['learcredential.employee.w3c.4']);
  });

  it('should compare versions numerically, not as strings', () => {
    // Lexicographic ordering would pick w3c.9 over w3c.10.
    expect(keepLatestCredentialConfigurationIds([
      'learcredential.employee.w3c.9',
      'learcredential.employee.w3c.10'
    ])).toEqual(['learcredential.employee.w3c.10']);
  });

  it('should treat each format family as its own lineage', () => {
    expect(keepLatestCredentialConfigurationIds([
      'learcredential.employee.w3c.1',
      'learcredential.employee.w3c.2',
      'learcredential.employee.sd.1'
    ])).toEqual(['learcredential.employee.w3c.2', 'learcredential.employee.sd.1']);
  });

  it('should treat each credential type as its own lineage', () => {
    expect(keepLatestCredentialConfigurationIds([
      'learcredential.employee.w3c.1',
      'learcredential.machine.w3c.1',
      'gx.labelcredential.w3c.1'
    ])).toEqual([
      'learcredential.employee.w3c.1',
      'learcredential.machine.w3c.1',
      'gx.labelcredential.w3c.1'
    ]);
  });

  it('should handle several lineages with several versions each', () => {
    expect(keepLatestCredentialConfigurationIds([
      'learcredential.employee.w3c.1',
      'learcredential.employee.w3c.4',
      'learcredential.employee.sd.1',
      'learcredential.employee.sd.2',
      'learcredential.machine.w3c.2',
      'learcredential.machine.w3c.3'
    ])).toEqual([
      'learcredential.employee.w3c.4',
      'learcredential.employee.sd.2',
      'learcredential.machine.w3c.3'
    ]);
  });

  it('should drop ids that carry no version', () => {
    expect(keepLatestCredentialConfigurationIds([
      'learcredential.employee.w3c.1',
      'learcredential.employee.w3c',
      'LEAR_CREDENTIAL_EMPLOYEE'
    ])).toEqual(['learcredential.employee.w3c.1']);
  });

  it('should not let an unversioned id survive as its own lineage', () => {
    expect(keepLatestCredentialConfigurationIds(['learcredential.employee.w3c'])).toEqual([]);
  });

  it('should return an empty list for an empty input', () => {
    expect(keepLatestCredentialConfigurationIds([])).toEqual([]);
  });

  it('should keep the position where each lineage first appeared', () => {
    // employee's slot is index 0 even though the winning version arrives last.
    expect(keepLatestCredentialConfigurationIds([
      'learcredential.employee.w3c.1',
      'learcredential.machine.w3c.1',
      'learcredential.employee.w3c.2'
    ])).toEqual(['learcredential.employee.w3c.2', 'learcredential.machine.w3c.1']);
  });

  it('should keep the first occurrence when the same version repeats', () => {
    const ids = ['learcredential.employee.w3c.1', 'learcredential.employee.w3c.1'];
    expect(keepLatestCredentialConfigurationIds(ids)).toEqual(['learcredential.employee.w3c.1']);
  });

  it('should not mutate the input', () => {
    const ids = ['learcredential.employee.w3c.1', 'learcredential.employee.w3c.2'];
    keepLatestCredentialConfigurationIds(ids);
    expect(ids).toEqual(['learcredential.employee.w3c.1', 'learcredential.employee.w3c.2']);
  });
});

describe('keepLatestCredentialConfigurations', () => {
  interface Entry { credentialConfigurationId: string; enabled: boolean }

  const entry = (credentialConfigurationId: string, enabled = false): Entry =>
    ({ credentialConfigurationId, enabled });

  it('should select the winner by the id read through the accessor', () => {
    const older = entry('learcredential.employee.w3c.1', true);
    const newer = entry('learcredential.employee.w3c.2');

    expect(keepLatestCredentialConfigurations([older, newer], e => e.credentialConfigurationId))
      .toEqual([newer]);
  });

  it('should return the original item references, not copies', () => {
    const newer = entry('learcredential.employee.w3c.2');
    const result = keepLatestCredentialConfigurations(
      [entry('learcredential.employee.w3c.1'), newer],
      e => e.credentialConfigurationId
    );

    expect(result[0]).toBe(newer);
  });

  it('should work over the issuer metadata record shape', () => {
    // credential_configurations_supported is keyed by configuration id.
    const supported = {
      'learcredential.employee.w3c.1': { format: 'jwt_vc_json' },
      'learcredential.employee.w3c.2': { format: 'jwt_vc_json' },
      'learcredential.employee.sd.1': { format: 'dc+sd-jwt' }
    };

    const latest = keepLatestCredentialConfigurations(Object.entries(supported), ([id]) => id);

    expect(latest.map(([id]) => id)).toEqual([
      'learcredential.employee.w3c.2',
      'learcredential.employee.sd.1'
    ]);
  });
});
