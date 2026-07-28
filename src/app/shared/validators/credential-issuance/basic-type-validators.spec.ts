import { FormControl } from '@angular/forms';
import { BasicTypeValidators } from './basic-type-validators';
import { CUSTOM_VALIDATORS_FACTORY_MAP } from './custom-validators';

describe('BasicTypeValidators', () => {
  describe('date', () => {
    const validator = BasicTypeValidators.date();

    it('acepta fecha ISO válida', () => {
      expect(validator(new FormControl('2026-07-27'))).toBeNull();
    });

    it('acepta año bisiesto real (29 de febrero)', () => {
      expect(validator(new FormControl('2024-02-29'))).toBeNull();
    });

    it('rechaza 29 de febrero en año no bisiesto (ES-01)', () => {
      expect(validator(new FormControl('2026-02-29'))).toEqual({
        date: { value: 'error.form.date' },
      });
    });

    it('rechaza mes imposible (ES-01)', () => {
      expect(validator(new FormControl('2026-13-31'))).toEqual({
        date: { value: 'error.form.date' },
      });
    });

    it('rechaza formato no ISO (dd-MM-yyyy)', () => {
      expect(validator(new FormControl('31-13-2026'))).toEqual({
        date: { value: 'error.form.date' },
      });
    });

    it('rechaza texto que no es una fecha', () => {
      expect(validator(new FormControl('no es una fecha'))).toEqual({
        date: { value: 'error.form.date' },
      });
    });

    it('vacío no produce error de formato (required aparte)', () => {
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl(null))).toBeNull();
    });
  });

  describe('numeric', () => {
    const validator = BasicTypeValidators.numeric();

    it('acepta enteros y decimales', () => {
      expect(validator(new FormControl('42'))).toBeNull();
      expect(validator(new FormControl('-3.14'))).toBeNull();
      expect(validator(new FormControl('0'))).toBeNull();
    });

    it('acepta un valor numérico nativo (control type number)', () => {
      expect(validator(new FormControl(42))).toBeNull();
    });

    it('rechaza no numérico (ES-01)', () => {
      expect(validator(new FormControl('abc'))).toEqual({
        numeric: { value: 'error.form.number' },
      });
    });

    it('rechaza coma decimal y espacios internos (alcance acotado AD-2)', () => {
      expect(validator(new FormControl('1,5'))).toEqual({
        numeric: { value: 'error.form.number' },
      });
      expect(validator(new FormControl('1 2'))).toEqual({
        numeric: { value: 'error.form.number' },
      });
    });

    it('rechaza notación científica y valores no finitos (alcance acotado AD-2)', () => {
      expect(validator(new FormControl('1e3'))).toEqual({
        numeric: { value: 'error.form.number' },
      });
      expect(validator(new FormControl('Infinity'))).toEqual({
        numeric: { value: 'error.form.number' },
      });
      expect(validator(new FormControl('NaN'))).toEqual({
        numeric: { value: 'error.form.number' },
      });
    });

    it('vacío o solo espacios no produce error de formato (required aparte)', () => {
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl('   '))).toBeNull();
      expect(validator(new FormControl(null))).toBeNull();
    });
  });

  describe('CUSTOM_VALIDATORS_FACTORY_MAP registration', () => {
    it('date y numeric están registrados y producen ExtendedValidatorFn', () => {
      const dateFn = CUSTOM_VALIDATORS_FACTORY_MAP.date();
      const numericFn = CUSTOM_VALIDATORS_FACTORY_MAP.numeric();
      expect(dateFn(new FormControl('2026-02-30'))).toHaveProperty('date');
      expect(numericFn(new FormControl('x'))).toHaveProperty('numeric');
    });
  });
});
