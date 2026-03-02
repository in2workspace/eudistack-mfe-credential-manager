import { DefaultValueAccessor } from '@angular/forms';

//trims and deletes double spaces from values received in inputs
function isString(value: unknown): boolean {
  return typeof value === 'string';
}

export function overrideDefaultValueAccessor(): void {
  const original = DefaultValueAccessor.prototype.registerOnChange;

  DefaultValueAccessor.prototype.registerOnChange = function (fn) {
    return original.call(this, value => {
      const trimmed = isString(value) ? value.trim().replaceAll(/ {2,}/g, ' ') : value;
      return fn(trimmed);
    });
  };
}
