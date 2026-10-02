import { DetailsPowerComponent } from '../components/details-power/details-power.component';
import { getOverrideForConfigId, POWER_CLAIM_RENDERER } from './custom-renderer-registry';

describe('custom renderer registry', () => {
  describe('getOverrideForConfigId', () => {
    it.each([
      'learcredential.employee.w3c',
      'learcredential.employee.sd',
      'learcredential.machine.w3c',
      'learcredential.machine.sd',
    ])('renders powers and labels the mandator name for %s', configId => {
      const override = getOverrideForConfigId(configId);

      expect(override?.claimOverrides?.['power']).toBe(POWER_CLAIM_RENDERER);
      expect(override?.i18nLabeledClaims).toEqual(['mandator.commonName']);
    });

    it('matches a versioned id by its unversioned prefix', () => {
      expect(getOverrideForConfigId('learcredential.employee.sd.2')).toBe(getOverrideForConfigId('learcredential.employee.sd'));
    });

    it('returns undefined for an unknown id, versioned or not', () => {
      expect(getOverrideForConfigId('unknown.credential')).toBeUndefined();
      expect(getOverrideForConfigId('unknown.credential.1')).toBeUndefined();
    });
  });

  describe('POWER_CLAIM_RENDERER', () => {
    it('renders with the power component and defaults a missing value to an empty list', () => {
      const powers = [{ function: 'Onboarding' }];

      expect(POWER_CLAIM_RENDERER.component).toBe(DetailsPowerComponent);
      expect(POWER_CLAIM_RENDERER.transformValue!(powers)).toBe(powers);
      expect(POWER_CLAIM_RENDERER.transformValue!(undefined)).toEqual([]);
    });
  });

  describe('Gaia-X label credential', () => {
    const overrides = getOverrideForConfigId('gx.labelcredential.w3c')!.claimOverrides!;

    it('defaults missing compliant credentials to an empty list', () => {
      const transform = overrides['gx:compliantCredentials'].transformValue!;
      const credentials = [{ id: 'urn:1' }];

      expect(transform(credentials)).toBe(credentials);
      expect(transform(null)).toEqual([]);
    });

    it('keeps validated criteria only when they are a list, under their own title', () => {
      const renderer = overrides['gx:validatedCriteria'];
      const criteria = ['criterion'];

      expect(renderer.transformValue!(criteria)).toBe(criteria);
      expect(renderer.transformValue!('criterion')).toEqual([]);
      expect(renderer.titleKey).toBe('gx:validatedCriteriaReference');
    });

    it('has no i18n-labelled claims', () => {
      expect(getOverrideForConfigId('gx.labelcredential.w3c')!.i18nLabeledClaims).toBeUndefined();
    });
  });
});
