import { ClaimDefinitionDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';
import {
  CredentialIssuanceViewModelControlField,
  CredentialIssuanceViewModelField
} from 'src/app/core/models/entity/lear-credential-issuance';
import { ValidatorEntryUnion } from 'src/app/shared/validators/credential-issuance/all-validators';

export interface ClaimsToFieldsOptions {
  /** Active locale (TranslateService.currentLang). Accepts 'es' against a display of 'es-ES'. */
  locale?: string;
  /** Only claims whose path contains this segment are mapped (e.g. 'mandatee'). */
  pathSegment?: string;
  /**
   * Required keys. AC-07 is resolved here because ClaimDefinitionDto does NOT expose
   * a required flag (neither the TS DTO nor the Java ClaimDefinition record);
   * until EUD-58, requiredness comes from the local provisional definition.
   */
  requiredKeys?: readonly string[];
  /**
   * AD-2 option C bridge: for keys the frontend already knows how to validate
   * (firstName, email...) its full definition is reused, only overwriting
   * the label with the one from the metadata.
   */
  fieldOverrides?: Readonly<Record<string, CredentialIssuanceViewModelField>>;
}

/** Last segment of the path: the FormControl's name within its FormGroup. */
export function claimKey(claim: ClaimDefinitionDto): string {
  return claim.path[claim.path.length - 1];
}

/** AC-02: display[].name for the current locale; falls back to the path if none is usable. */
export function resolveClaimLabel(claim: ClaimDefinitionDto, locale?: string): string {
  const displays = claim.display ?? [];
  const language = locale?.split('-')[0];

  const exactMatch = locale ? displays.find(d => d.locale === locale) : undefined;
  const languageMatch = language ? displays.find(d => d.locale?.split('-')[0] === language) : undefined;
  const chosen = exactMatch ?? languageMatch ?? displays[0];

  return chosen?.name?.trim() ? chosen.name.trim() : claim.path.join('.');
}

/**
 * AC-02 / EC-02: turns the credential definition into form fields.
 * Returns [] when there are no usable claims, so the caller decides the bridge
 * (provisional employee field set, AD-2 option C).
 *
 * No format/type validators are added: that's EUD-73.
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
    // Duplicate keys would collide in the FormGroup: the first one declared wins.
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
