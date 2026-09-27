import { CredentialCatalogEntry } from '../dto/credential-catalog.dto';
import { resolveDeliveryEligibility } from './delivery-eligibility-snapshot';

describe('resolveDeliveryEligibility', () => {

  const CONFIG_ID = 'learcredential.employee.w3c.2';

  function entry(overrides: Partial<CredentialCatalogEntry> = {}): CredentialCatalogEntry {
    return {
      credentialConfigurationId: CONFIG_ID,
      displayName: 'LEAR Credential Employee',
      enabled: true,
      ...overrides,
    };
  }

  it('state 1 -- maps a non-empty deliveryModes literally (EC-06)', () => {
    const snapshot = resolveDeliveryEligibility([entry({ deliveryModes: ['direct', 'ui', 'email'] })]);

    expect(snapshot.status).toBe('read');
    expect(snapshot.status === 'read' && snapshot.modesByConfigId.get(CONFIG_ID))
      .toEqual(['direct', 'ui', 'email']);
  });

  it('state 2a -- an entry whose deliveryModes field is undefined resolves to no map entry (EC-10)', () => {
    const snapshot = resolveDeliveryEligibility([entry()]);

    expect(snapshot.status).toBe('read');
    expect(snapshot.status === 'read' && snapshot.modesByConfigId.get(CONFIG_ID)).toBeUndefined();
  });

  it('state 2b -- a configId absent from the array entirely resolves the same as 2a (defensive rule a)', () => {
    const snapshot = resolveDeliveryEligibility([]);

    expect(snapshot.status).toBe('read');
    expect(snapshot.status === 'read' && snapshot.modesByConfigId.get(CONFIG_ID)).toBeUndefined();
  });

  it('state 3 -- an enabled entry with an empty deliveryModes maps to []', () => {
    const snapshot = resolveDeliveryEligibility([entry({ deliveryModes: [] })]);

    expect(snapshot.status).toBe('read');
    expect(snapshot.status === 'read' && snapshot.modesByConfigId.get(CONFIG_ID)).toEqual([]);
  });

  it('state 4 -- an undefined read resolves to unreadable, regardless of failure cause (ES-08)', () => {
    expect(resolveDeliveryEligibility(undefined)).toEqual({ status: 'unreadable' });
  });

  it('defensive rule b -- a disabled entry is ignored even with an empty deliveryModes, not treated as state 3', () => {
    const snapshot = resolveDeliveryEligibility([entry({ enabled: false, deliveryModes: [] })]);

    expect(snapshot.status).toBe('read');
    expect(snapshot.status === 'read' && snapshot.modesByConfigId.get(CONFIG_ID)).toBeUndefined();
  });

  it('narrows deliveryModes to recognized tokens, silently dropping anything else', () => {
    const snapshot = resolveDeliveryEligibility([
      entry({ deliveryModes: ['direct', 'bogus', 'ui'] }),
    ]);

    expect(snapshot.status === 'read' && snapshot.modesByConfigId.get(CONFIG_ID)).toEqual(['direct', 'ui']);
  });

  it('resolves multiple configIds independently in the same read', () => {
    const otherConfigId = 'learcredential.employee.sd.1';
    const snapshot = resolveDeliveryEligibility([
      entry({ deliveryModes: ['direct'] }),
      entry({ credentialConfigurationId: otherConfigId, deliveryModes: [] }),
    ]);

    expect(snapshot.status).toBe('read');
    expect(snapshot.status === 'read' && snapshot.modesByConfigId.get(CONFIG_ID)).toEqual(['direct']);
    expect(snapshot.status === 'read' && snapshot.modesByConfigId.get(otherConfigId)).toEqual([]);
  });
});
