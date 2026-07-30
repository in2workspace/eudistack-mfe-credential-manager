import { ClaimDefinitionDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';
import {
  CredentialIssuanceViewModelControlField,
  CredentialIssuanceViewModelField
} from 'src/app/core/models/entity/lear-credential-issuance';
import { ValidatorEntryUnion } from 'src/app/shared/validators/credential-issuance/all-validators';

export interface ClaimsToFieldsOptions {
  /** Locale activo (TranslateService.currentLang). Admite 'es' frente a un display 'es-ES'. */
  locale?: string;
  /** Solo se mapean los claims cuyo path contiene este segmento (p.ej. 'mandatee'). */
  pathSegment?: string;
  /**
   * Claves obligatorias. AC-07 se resuelve aqui porque ClaimDefinitionDto NO expone
   * flag de obligatoriedad (ni el DTO TS ni el record ClaimDefinition de Java);
   * hasta EUD-58 la obligatoriedad la aporta la definicion provisional local.
   */
  requiredKeys?: readonly string[];
  /**
   * Puente AD-2 opcion C: para las claves que el frontend ya sabe validar
   * (firstName, email...) se reutiliza su definicion completa y solo se
   * sobrescribe la etiqueta con la del metadata.
   */
  fieldOverrides?: Readonly<Record<string, CredentialIssuanceViewModelField>>;
}

/** Ultimo segmento del path: es el nombre del FormControl dentro de su FormGroup. */
export function claimKey(claim: ClaimDefinitionDto): string {
  return claim.path[claim.path.length - 1];
}

/** AC-02: display[].name del locale actual; si no hay display utilizable, el path. */
export function resolveClaimLabel(claim: ClaimDefinitionDto, locale?: string): string {
  const displays = claim.display ?? [];
  const language = locale?.split('-')[0];

  const exactMatch = locale ? displays.find(d => d.locale === locale) : undefined;
  const languageMatch = language ? displays.find(d => d.locale?.split('-')[0] === language) : undefined;
  const chosen = exactMatch ?? languageMatch ?? displays[0];

  return chosen?.name?.trim() ? chosen.name.trim() : claim.path.join('.');
}

/**
 * AC-02 / EC-02: convierte la definicion de la credencial en campos de formulario.
 * Devuelve [] si no hay claims utilizables, para que quien llama decida el puente
 * (conjunto provisional de empleado, AD-2 opcion C).
 *
 * No se anaden validadores de formato/tipo: eso es EUD-73.
 */
export function mapClaimsToFields(
  claims: readonly ClaimDefinitionDto[] | undefined,
  options: ClaimsToFieldsOptions = {}
): CredentialIssuanceViewModelField[] {
  const { locale, pathSegment, requiredKeys = [], fieldOverrides = {} } = options;
  if (!claims?.length) return [];

  const fields: CredentialIssuanceViewModelField[] = [];
  const seenKeys = new Set<string>();

  for (const claim of claims) {
    if (!claim?.path?.length) continue;
    if (pathSegment && !claim.path.includes(pathSegment)) continue;

    const key = claimKey(claim);
    // Claves duplicadas colisionarian en el FormGroup: gana la primera declarada.
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const label = resolveClaimLabel(claim, locale);

    const override = fieldOverrides[key];
    if (override) {
      fields.push({ ...override, label });
      continue;
    }

    const validators: ValidatorEntryUnion[] = requiredKeys.includes(key) ? [{ name: 'required' }] : [];
    const derivedField: CredentialIssuanceViewModelControlField = {
      key,
      label,
      type: 'control',
      controlType: 'text',
      validators
    };
    fields.push(derivedField);
  }

  return fields;
}
