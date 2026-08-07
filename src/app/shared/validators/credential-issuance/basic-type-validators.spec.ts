import { FormControl } from '@angular/forms';
import { BasicTypeValidators } from './basic-type-validators';
import { CUSTOM_VALIDATORS_FACTORY_MAP } from './custom-validators';

describe('BasicTypeValidators', () => {
  describe('date', () => {
    const validator = BasicTypeValidators.date();

    it('accepts a valid ISO date', () => {
      expect(validator(new FormControl('2026-07-27'))).toBeNull();
    });

    it('accepts a real leap year (February 29)', () => {
      expect(validator(new FormControl('2024-02-29'))).toBeNull();
    });

    it('rejects February 29 on a non-leap year (ES-01)', () => {
      expect(validator(new FormControl('2026-02-29'))).toEqual({
        date: { value: 'error.form.date' },
      });
    });

    it('rejects an impossible month (ES-01)', () => {
      expect(validator(new FormControl('2026-13-31'))).toEqual({
        date: { value: 'error.form.date' },
      });
    });

    it('rejects non-ISO format (dd-MM-yyyy)', () => {
      expect(validator(new FormControl('31-13-2026'))).toEqual({
        date: { value: 'error.form.date' },
      });
    });

    it('rejects text that is not a date', () => {
      expect(validator(new FormControl('not a date'))).toEqual({
        date: { value: 'error.form.date' },
      });
    });

    it('empty does not produce a format error (required is separate)', () => {
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl(null))).toBeNull();
    });
  });

  describe('numeric', () => {
    const validator = BasicTypeValidators.numeric();

    it('accepts integers and decimals', () => {
      expect(validator(new FormControl('42'))).toBeNull();
      expect(validator(new FormControl('-3.14'))).toBeNull();
      expect(validator(new FormControl('0'))).toBeNull();
    });

    it('accepts a native number value (controlType number)', () => {
      expect(validator(new FormControl(42))).toBeNull();
    });

    it('rejects non-numeric input (ES-01)', () => {
      expect(validator(new FormControl('abc'))).toEqual({
        numeric: { value: 'error.form.number' },
      });
    });

    it('rejects comma decimals and internal spaces (scope intentionally limited, AD-2)', () => {
      expect(validator(new FormControl('1,5'))).toEqual({
        numeric: { value: 'error.form.number' },
      });
      expect(validator(new FormControl('1 2'))).toEqual({
        numeric: { value: 'error.form.number' },
      });
    });

    it('rejects scientific notation and non-finite values (scope intentionally limited, AD-2)', () => {
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

    it('empty or whitespace-only does not produce a format error (required is separate)', () => {
      expect(validator(new FormControl(''))).toBeNull();
      expect(validator(new FormControl('   '))).toBeNull();
      expect(validator(new FormControl(null))).toBeNull();
    });
  });

  describe('CUSTOM_VALIDATORS_FACTORY_MAP registration', () => {
    it('date and numeric are registered and produce an ExtendedValidatorFn', () => {
      const dateFn = CUSTOM_VALIDATORS_FACTORY_MAP.date();
      const numericFn = CUSTOM_VALIDATORS_FACTORY_MAP.numeric();
      expect(dateFn(new FormControl('2026-02-30'))).toHaveProperty('date');
      expect(numericFn(new FormControl('x'))).toHaveProperty('numeric');
    });
  });
});
