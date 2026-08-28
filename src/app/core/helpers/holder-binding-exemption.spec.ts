import {
  EXEMPT_CONFIGURATION_ID_PREFIXES_FOR_TEST,
  requiresRequestHolderKey,
} from './holder-binding-exemption';

describe('holder-binding-exemption', () => {

  /**
   * Pins the exemption's reach. It mirrors `HolderBindingExemption` in `eudistack-core-issuer`, and
   * nothing at build time keeps the two in step — this test is the only thing that makes widening
   * either side a deliberate act rather than a silent divergence.
   */
  it('covers exactly the two machine credential families', () => {
    expect(EXEMPT_CONFIGURATION_ID_PREFIXES_FOR_TEST).toEqual([
      'learcredential.machine.sd.',
      'learcredential.machine.w3c.',
    ]);
  });

  it.each([
    'learcredential.machine.sd.1',
    'learcredential.machine.w3c.3',
  ])('requires a holder key for the migrated type %s', configId => {
    expect(requiresRequestHolderKey(configId)).toBe(true);
  });

  it.each([
    'learcredential.machine.sd.2',
    'learcredential.machine.w3c.4',
  ])('covers future versions of the same families without a code change (%s)', configId => {
    expect(requiresRequestHolderKey(configId)).toBe(true);
  });

  it.each([
    'learcredential.employee.w3c.4',
    'gx.labelcredential.w3c.2',
    'eu.europa.ec.eudi.pid.1',
    'doctorid.sd.1',
  ])('does not require one for %s', configId => {
    expect(requiresRequestHolderKey(configId)).toBe(false);
  });

  it('does not leak to a type that merely starts alike', () => {
    // 'learcredential.machinery' shares a prefix with 'learcredential.machine' up to the dot that
    // ends the family name — which is exactly why the prefixes carry that trailing dot.
    expect(requiresRequestHolderKey('learcredential.machinery.w3c.1')).toBe(false);
  });

  it('is false for an undefined configuration', () => {
    expect(requiresRequestHolderKey(undefined)).toBe(false);
  });
});
