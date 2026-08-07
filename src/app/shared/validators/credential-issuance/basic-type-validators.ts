import { AbstractControl } from '@angular/forms';
import { ExtendedValidatorFn, ExtendedValidatorErrors } from 'src/app/core/models/entity/validator-types';

export class BasicTypeValidators {
  /**
   * Valid calendar date (ISO yyyy-MM-dd, the native value of input type="date"). Empty -> null
   * (required is a separate validator).
   * Only ever handles strings: input[type="date"] uses Angular's DefaultValueAccessor, which
   * never converts the value to a number (unlike input[type="number"] — see numeric() below).
   */
  public static date(): ExtendedValidatorFn<'date'> {
    return (control: AbstractControl): ExtendedValidatorErrors<'date'> | null => {
      const value = control.value;
      if (value == null || value === '') {
        return null;
      }
      if (typeof value !== 'string') {
        return { date: { value: 'error.form.date' } };
      }
      const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!isoMatch) {
        return { date: { value: 'error.form.date' } };
      }
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      const valid =
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day;
      return valid ? null : { date: { value: 'error.form.date' } };
    };
  }

  /**
   * Integer or decimal number (dot as decimal separator; no comma, no scientific notation —
   * scope intentionally limited to basic type checking, AD-2). Empty -> null.
   * Accepts both number and string: input[type="number"] uses Angular's NumberValueAccessor,
   * which parses the DOM value with parseFloat() before it ever reaches the FormControl — so
   * control.value here is normally a number, not a string (unlike date() above).
   */
  public static numeric(): ExtendedValidatorFn<'numeric'> {
    return (control: AbstractControl): ExtendedValidatorErrors<'numeric'> | null => {
      const value = control.value;
      if (value == null || value === '') {
        return null;
      }
      const asString = typeof value === 'number' ? String(value) : value;
      if (typeof asString !== 'string') {
        return { numeric: { value: 'error.form.number' } };
      }
      const normalized = asString.trim();
      if (normalized === '') {
        return null;
      }
      const numericPattern = /^-?\d+(\.\d+)?$/;
      return numericPattern.test(normalized)
        ? null
        : { numeric: { value: 'error.form.number' } };
    };
  }
}

export const BASIC_TYPE_VALIDATORS_FACTORY_MAP = {
  date: BasicTypeValidators.date,
  numeric: BasicTypeValidators.numeric,
} as const;
