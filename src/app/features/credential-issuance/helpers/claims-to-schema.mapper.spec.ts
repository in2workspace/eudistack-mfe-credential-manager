import { ClaimDefinitionDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';
import { claimKey, mapClaimsToFields, resolveClaimLabel } from './claims-to-schema.mapper';
import { CredentialIssuanceViewModelControlField } from 'src/app/core/models/entity/lear-credential-issuance';

// mapClaimsToFields always produces controls (never groups); cast here so the function's
// public return type doesn't have to be widened just for test convenience.
const asControls = (fields: ReturnType<typeof mapClaimsToFields>) =>
  fields as CredentialIssuanceViewModelControlField[];

describe('claims-to-schema.mapper', () => {

  const claim = (path: string[], display: { name: string; locale: string }[] = []): ClaimDefinitionDto =>
    ({ path, display });

  describe('resolveClaimLabel()', () => {
    it('should prefer the exact locale match (AC-02)', () => {
      const c = claim(['mandatee', 'firstName'], [
        { name: 'First name', locale: 'en' },
        { name: 'Nombre', locale: 'es-ES' }
      ]);
      expect(resolveClaimLabel(c, 'es-ES')).toBe('Nombre');
    });

    it('should fall back to a language match when the exact locale is absent', () => {
      const c = claim(['mandatee', 'firstName'], [{ name: 'Nombre', locale: 'es-ES' }]);
      expect(resolveClaimLabel(c, 'es')).toBe('Nombre');
    });

    it('should fall back to the first display entry when no locale matches', () => {
      const c = claim(['mandatee', 'firstName'], [{ name: 'First name', locale: 'en' }]);
      expect(resolveClaimLabel(c, 'ca')).toBe('First name');
    });

    it('should fall back to the joined path when display is empty (AC-02)', () => {
      expect(resolveClaimLabel(claim(['mandatee', 'firstName']), 'es')).toBe('mandatee.firstName');
    });

    it('should fall back to the joined path when the display name is blank', () => {
      const c = claim(['mandatee', 'firstName'], [{ name: '   ', locale: 'es' }]);
      expect(resolveClaimLabel(c, 'es')).toBe('mandatee.firstName');
    });
  });

  describe('claimKey()', () => {
    it('should use the last path segment so the control resolves inside its FormGroup', () => {
      expect(claimKey(claim(['credentialSubject', 'mandatee', 'firstName']))).toBe('firstName');
    });
  });

  describe('mapClaimsToFields()', () => {
    it('should return an empty list for undefined or empty claims (EC-02 falls back upstream)', () => {
      expect(mapClaimsToFields(undefined)).toEqual([]);
      expect(mapClaimsToFields([])).toEqual([]);
    });

    it('should map a claim to a text control keyed by the last path segment', () => {
      const [field] = mapClaimsToFields([claim(['mandatee', 'nickname'], [{ name: 'Alias', locale: 'es' }])], { locale: 'es' });

      expect(field).toEqual({
        key: 'nickname',
        label: 'Alias',
        type: 'control',
        controlType: 'text',
        validators: []
      });
    });

    it('should mark only the keys listed as required (AC-07)', () => {
      const fields = asControls(mapClaimsToFields(
        [claim(['mandatee', 'firstName']), claim(['mandatee', 'nickname'])],
        { requiredKeys: ['firstName'] }
      ));

      expect(fields[0].validators).toEqual([{ name: 'required' }]);
      expect(fields[1].validators).toEqual([]);
    });

    it('should not add format or type validators (that is EUD-73)', () => {
      const [field] = asControls(mapClaimsToFields([claim(['mandatee', 'email'])], { requiredKeys: ['email'] }));

      expect(field.validators).toEqual([{ name: 'required' }]);
    });

    it('should filter claims by path segment so mandator/power stay out of scope', () => {
      const fields = mapClaimsToFields(
        [claim(['mandatee', 'firstName']), claim(['mandator', 'organization']), claim(['power', 'function'])],
        { pathSegment: 'mandatee' }
      );

      expect(fields.map(f => f.key)).toEqual(['firstName']);
    });

    it('should reuse the provisional field definition and only override its label (AD-2 bridge)', () => {
      const override = { key: 'email', type: 'control', controlType: 'text', validators: [{ name: 'required' }, { name: 'customEmail' }] } as any;

      const [field] = asControls(mapClaimsToFields(
        [claim(['mandatee', 'email'], [{ name: 'Correo del empleado', locale: 'es' }])],
        { locale: 'es', fieldOverrides: { email: override } }
      ));

      expect(field.label).toBe('Correo del empleado');
      expect(field.validators).toEqual([{ name: 'required' }, { name: 'customEmail' }]);
    });

    it('should skip claims with an empty path and duplicated keys', () => {
      const fields = mapClaimsToFields([
        claim([]),
        claim(['mandatee', 'firstName'], [{ name: 'Primero', locale: 'es' }]),
        claim(['other', 'firstName'], [{ name: 'Duplicado', locale: 'es' }])
      ], { locale: 'es' });

      expect(fields).toHaveLength(1);
      expect(fields[0].label).toBe('Primero');
    });
  });
});
