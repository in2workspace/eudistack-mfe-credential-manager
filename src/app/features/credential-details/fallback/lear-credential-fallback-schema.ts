/* =============================================================================
 * HARDCODED FALLBACK SCHEMA — LEAR CREDENTIAL EMPLOYEE / MACHINE
 * =============================================================================
 *
 *  TEMPORARY - This is temporary while the issuer metadata doesn't expose only-read VC types separately from issuable types.
 * 
 * WHY THIS EXISTS
 * ---------------
 * The details screen builds its view model from the issuer metadata
 * (`credential_configurations_supported[configId].credential_metadata.claims`).
 * When neither an exact lookup nor the legacy type match finds a configuration
 * that CARRIES claims, there is no schema at all and the screen renders nothing.
 *
 * That happens whenever a credential outlives the metadata that described it:
 * an issuance made against a configuration the issuer has since dropped, an
 * environment whose metadata was trimmed to the versions it still issues, or a
 * legacy `credential_configuration_id` whose type name no longer appears in any
 * `credential_definition.type`.
 *
 * The two LEAR credentials share one stable, protocol-level shape
 * (`credentialSubject.mandate.{mandator,mandatee,power}`), so their MINIMUM
 * readable content can be described without the metadata. Everything above this
 * module — the header (type, status, validFrom, validUntil), the issuer and
 * credential-status side card — already reads the credential directly and needs
 * nothing from here.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 *   - It is not a substitute for the metadata: it shows the minimum agreed
 *     fields, not every claim a configuration may declare. Whenever metadata
 *     claims exist they win (see `CredentialDetailsService.resolveSchema`).
 *   - It carries no labels of its own. Field keys reuse the existing
 *     `credentialDetails.*` i18n entries, so the fallback is localized by the
 *     same catalogue as everything else and adds no translation debt.
 *
 * HOW TO REMOVE (once every environment's metadata declares the configurations
 * of all credentials it has issued)
 * -----------------------------------------------------------------------------
 *   1. Delete this folder (`fallback/`).
 *   2. In `dynamic-schema-builder.service.ts`, drop `buildFallbackSchema()`.
 *   3. In `credential-details.service.ts`, drop the guarded "FALLBACK" block in
 *      `resolveSchema()` and the `?? readSpecificCredentialType(...)` tail of
 *      `credentialDisplayName$`.
 * Behaviour then reverts to metadata-or-nothing, with no residue.
 * ============================================================================= */

import { DetailsGroupField, DetailsKeyValueField } from 'src/app/core/models/entity/lear-credential-details';
import { Power } from 'src/app/core/models/entity/lear-credential';
import { POWER_CLAIM_RENDERER } from '../services/custom-renderer-registry';

/** The credential families this module can describe without metadata. */
export type LearFallbackLineage = 'employee' | 'machine';

/**
 * Markers matched case-insensitively as SUBSTRINGS, against the configuration id, every
 * entry of `type[]` and the SD-JWT `vct`. One family is named several ways in the wild:
 * the versioned configuration id (`learcredential.employee.w3c.4`), the W3C type name
 * (`LEARCredentialEmployee`) and the legacy configuration id (`LEAR_CREDENTIAL_EMPLOYEE`).
 */
const LINEAGE_MARKERS: ReadonlyArray<{ readonly lineage: LearFallbackLineage; readonly markers: readonly string[] }> = [
  { lineage: 'employee', markers: ['learcredential.employee', 'learcredentialemployee', 'lear_credential_employee'] },
  { lineage: 'machine', markers: ['learcredential.machine', 'learcredentialmachine', 'lear_credential_machine'] },
];

/** Types that carry no credential-specific meaning and must be ignored when naming a credential. */
const GENERIC_TYPES = new Set(['VerifiableCredential', 'VerifiableAttestation']);

/**
 * Which LEAR family a credential belongs to, or `null` when it is neither — in which case
 * the caller must keep its existing behaviour rather than guess a shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveLearFallbackLineage(configId: string | undefined, credential: any): LearFallbackLineage | null {
  const declaredTypes: unknown[] = Array.isArray(credential?.type) ? credential.type : [];
  const candidates = [configId, ...declaredTypes, credential?.vct]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(value => value.toLowerCase());

  for (const { lineage, markers } of LINEAGE_MARKERS) {
    if (candidates.some(candidate => markers.some(marker => candidate.includes(marker)))) {
      return lineage;
    }
  }
  return null;
}

/**
 * The specific (non-generic) type a credential declares, e.g. `LEARCredentialMachine`.
 *
 * Used as the last resort for the header's credential name: a credential with no metadata
 * display and no configuration id would otherwise render a blank type.
 */
export function readSpecificCredentialType(credential: unknown): string | undefined {
  const types = (credential as { type?: unknown })?.type;
  if (!Array.isArray(types)) return undefined;
  return types.find((type): type is string => typeof type === 'string' && !!type && !GENERIC_TYPES.has(type));
}

/**
 * The mandatee fields of each family.
 *
 * The mandator is a person in both families, so it is described once. The mandatee is NOT:
 * an employee mandatee is a person (name, email), a machine mandatee is a machine, identified
 * by its `id` and `domain`, and carries no name or email at all. Describing both with the
 * person fields rendered every machine mandatee as two empty rows ("-"), which reads as "the
 * credential lost its data" when the truth is that its data was never those fields.
 */
const MANDATEE_FIELDS: Record<LearFallbackLineage, readonly DetailsKeyValueField[]> = {
  employee: [
    keyValueField('name', c => readPartyName(readMandate(c).mandatee)),
    keyValueField('email', c => readPartyEmail(readMandate(c).mandatee)),
  ],
  machine: [
    keyValueField('id', c => readText(readMandate(c).mandatee?.['id'])),
    keyValueField('domain', c => readText(readMandate(c).mandatee?.['domain'])),
  ],
};

/**
 * The main-card groups for a LEAR credential, read straight from the credential.
 *
 * The mandator group is the same minimal set for both families (name, email, company, VAT);
 * the mandatee group is per-family, see `MANDATEE_FIELDS`. `power` is appended only when the
 * credential actually carries powers: `DetailsPowerComponent` renders its domain heading
 * unconditionally, so an empty group would read as "no powers granted" where the truth is
 * "no power claim present".
 *
 * Values stay lazy (`(c) => …`), exactly like `DynamicSchemaBuilder`, so a malformed
 * branch is isolated by `CredentialDetailsService.safeCompute` instead of failing the
 * whole schema.
 */
export function buildLearCredentialFallbackMainFields(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  credential: any,
  lineage: LearFallbackLineage,
): DetailsGroupField[] {
  const groups: DetailsGroupField[] = [
    {
      key: 'mandator',
      type: 'group',
      value: [
        keyValueField('name', c => readPartyName(readMandate(c).mandator)),
        keyValueField('email', c => readPartyEmail(readMandate(c).mandator)),
        keyValueField('organization', c => readText(readMandate(c).mandator?.['organization'])),
        keyValueField('organizationIdentifier', c => readText(readMandate(c).mandator?.['organizationIdentifier'])),
      ],
    },
    {
      key: 'mandatee',
      type: 'group',
      value: [...MANDATEE_FIELDS[lineage]],
    },
  ];

  if (readPowers(credential).length > 0) {
    groups.push({
      key: 'power',
      type: 'group',
      custom: {
        component: POWER_CLAIM_RENDERER.component,
        token: POWER_CLAIM_RENDERER.token,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value: (c: any) => {
          const powers = readPowers(c);
          return POWER_CLAIM_RENDERER.transformValue ? POWER_CLAIM_RENDERER.transformValue(powers) : powers;
        },
      },
      value: [],
    });
  }

  return groups;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function keyValueField(key: string, read: (credential: any) => unknown): DetailsKeyValueField {
  return { key, type: 'key-value', value: read };
}

/** The party/power container of a mandate, whatever nesting the credential uses. */
interface MandateLike {
  readonly mandator?: Record<string, unknown>;
  readonly mandatee?: Record<string, unknown>;
  readonly power?: unknown;
}

/**
 * Locates the mandate.
 *
 * `LEARCredentialDataNormalizer` already lifts SD-JWT's flat shapes into
 * `credentialSubject.mandate`, but only for credentials it recognizes by their versioned
 * type or `vct`; a legacy-named one reaches here untouched. Trying the two flat shapes as
 * well costs two property checks and removes that dependency.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readMandate(credential: any): MandateLike {
  const candidates = [credential?.credentialSubject?.mandate, credential?.credentialSubject, credential, credential?.mandate];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object'
      && ('mandator' in candidate || 'mandatee' in candidate || 'power' in candidate)) {
      return candidate as MandateLike;
    }
  }
  return {};
}

/**
 * A party's display name: `firstName` + `lastName` when either is present, otherwise
 * `commonName`.
 *
 * Both spellings are live at once — the employee mandatee carries first/last names while
 * the mandator of both families carries only `commonName` — so this is a real fallback,
 * not legacy tolerance.
 */
function readPartyName(party: Record<string, unknown> | undefined): string | null {
  const composed = [readText(party?.['firstName']), readText(party?.['lastName'])]
    .filter((part): part is string => !!part)
    .join(' ');
  return composed || readText(party?.['commonName']);
}

/** A party's email under either spelling (`emailAddress` is the DOME v1 key). */
function readPartyEmail(party: Record<string, unknown> | undefined): string | null {
  return readText(party?.['email']) ?? readText(party?.['emailAddress']);
}

/**
 * The powers as an array.
 *
 * A single power object rather than an array appears in older issuances; wrapping it here
 * keeps `DetailsPowerComponent`, which indexes `powers[0]`, from receiving a non-array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readPowers(credential: any): Power[] {
  const raw = readMandate(credential).power;
  if (Array.isArray(raw)) return raw as Power[];
  return raw && typeof raw === 'object' ? [raw as Power] : [];
}

/** A trimmed non-empty string, or `null` so absent and blank values render identically. */
function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
