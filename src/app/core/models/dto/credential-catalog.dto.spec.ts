import { CredentialCatalogEntry } from './credential-catalog.dto';

describe('CredentialCatalogEntry', () => {

  it('represents state 1 (deliveryModes present and non-empty)', () => {
    const entry: CredentialCatalogEntry = {
      credentialConfigurationId: 'learcredential.employee.w3c.2',
      displayName: 'LEAR Credential Employee',
      enabled: true,
      deliveryModes: ['direct', 'ui', 'email'],
      schemaEligibleModes: ['direct', 'ui', 'email'],
    };

    expect(entry.deliveryModes).toEqual(['direct', 'ui', 'email']);
  });

  it('represents state 2 -- a pre-EUD-169 Issuer (deliveryModes and schemaEligibleModes absent)', () => {
    const entry: CredentialCatalogEntry = {
      credentialConfigurationId: 'learcredential.employee.w3c.2',
      displayName: 'LEAR Credential Employee',
      enabled: true,
    };

    expect(entry.deliveryModes).toBeUndefined();
    expect(entry.schemaEligibleModes).toBeUndefined();
  });

  it('represents state 3 -- an explicitly empty set (deliveryModes present but empty)', () => {
    const entry: CredentialCatalogEntry = {
      credentialConfigurationId: 'learcredential.employee.w3c.2',
      displayName: 'LEAR Credential Employee',
      enabled: true,
      deliveryModes: [],
    };

    expect(entry.deliveryModes).toEqual([]);
  });

  it('represents a disabled entry, shaped like any other', () => {
    const entry: CredentialCatalogEntry = {
      credentialConfigurationId: 'learcredential.machine.sd.1',
      displayName: 'LEAR Credential Machine',
      enabled: false,
    };

    expect(entry.enabled).toBe(false);
  });
});
