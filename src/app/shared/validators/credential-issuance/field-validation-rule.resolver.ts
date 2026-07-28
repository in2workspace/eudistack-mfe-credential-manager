export type FieldBasicType = 'text' | 'date' | 'number';

export interface FieldValidationRule {
  readonly key: string;
  readonly required: boolean;
  readonly basicType: FieldBasicType;
}

/** Metadatos mínimos consumibles hoy (provisional) y mañana (EUD-71 mapper / EUD-50 catalog). */
export interface FieldValidationRuleInput {
  readonly key: string;
  /** Señal explícita de obligatoriedad cuando el catálogo la declare (futuro). */
  readonly required?: boolean;
  /** Tipo básico declarado; ausente → EC-01 default 'text'. */
  readonly basicType?: FieldBasicType;
}

export interface FieldValidationRuleResolver {
  resolve(input: FieldValidationRuleInput): FieldValidationRule;
}

/**
 * Claves obligatorias mientras EUD-50/58/59 no declaren el catálogo real.
 * Alineado con los campos legacy que hoy llevan `required` en validators-entries.ts
 * (nameValidatorEntries, emailValidatorEntries, orgIdValidatorEntries, serialNumberValidatorEntries).
 */
const PROVISIONAL_REQUIRED_KEYS = new Set<string>([
  'firstName',
  'lastName',
  'email',
  'serialNumber',
  'organization',
  'organizationIdentifier',
]);

const BASIC_TYPES: ReadonlySet<FieldBasicType> = new Set(['text', 'date', 'number']);

function normalizeBasicType(raw?: FieldBasicType): FieldBasicType {
  if (raw && BASIC_TYPES.has(raw)) {
    return raw;
  }
  return 'text'; // EC-01
}

function resolveRequired(input: FieldValidationRuleInput): boolean {
  if (input.required === true) return true;
  if (input.required === false) return false; // EC-02
  return PROVISIONAL_REQUIRED_KEYS.has(input.key);
}

export class ProvisionalFieldValidationRuleResolver implements FieldValidationRuleResolver {
  resolve(input: FieldValidationRuleInput): FieldValidationRule {
    return {
      key: input.key,
      required: resolveRequired(input),
      basicType: normalizeBasicType(input.basicType),
    };
  }
}

/** Instancia compartida para consumo directo (sin DI) hasta que exista un consumidor real (T7). */
export const PROVISIONAL_FIELD_VALIDATION_RULE_RESOLVER =
  new ProvisionalFieldValidationRuleResolver();
