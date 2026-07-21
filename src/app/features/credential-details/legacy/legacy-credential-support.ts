/* =============================================================================
 * LEGACY CREDENTIAL SUPPORT — TEMPORARY, SELF-CONTAINED, REMOVABLE
 * =============================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * Credentials migrated from an older issuer/wallet carry PRE-VERSIONED type
 * names in their `type[]` array — e.g. "LEARCredentialEmployee",
 * "LEARCredentialMachine", "gx:LabelCredential" — instead of the current
 * versioned configuration ids ("learcredential.employee.w3c.4", ...). Their
 * stored `credential_configuration_id` is also a legacy value
 * (e.g. "LEAR_CREDENTIAL_EMPLOYEE"), so an exact lookup against the issuer
 * metadata (`credential_configurations_supported`) FAILS and the details view
 * cannot resolve a schema.
 *
 * Additionally, the oldest (DOME v1) credentials use a different data shape:
 *   - powers use `tmf_domain` / `tmf_function` / `tmf_action`
 *     (current model: `domain` / `function` / `action`)
 *   - mandator uses `emailAddress` (current model: `email`)
 *
 * WHAT THIS DOES
 * --------------
 *   - matchLegacyConfig():     resolves a legacy `type[]` to the HIGHEST
 *                              versioned config that still DECLARES that legacy
 *                              type name in credential_definition.type
 *                              (employee -> w3c.3, machine -> w3c.2, label -> w3c.1).
 *   - normalizeLegacyCredential(): rewrites tmf_* powers and emailAddress so the
 *                              existing renderers work unchanged.
 *
 * HOW TO REMOVE (when no legacy issuances remain in the DB)
 * ---------------------------------------------------------
 *   1. Delete this folder (`legacy/`).
 *   2. In credential-details.service.ts, delete the two guarded
 *      "LEGACY fallback" blocks (resolveSchema + credentialDisplayName$).
 *   3. (Optional) drop CredentialIssuerMetadataService.getAllConfigurations()
 *      if unused elsewhere.
 * Behaviour then reverts to exact-lookup-only, with no residue.
 * ============================================================================= */

import { CredentialConfigurationDto } from 'src/app/core/models/dto/credential-issuer-metadata.dto';

export interface LegacyConfigMatch {
  configId: string;
  config: CredentialConfigurationDto;
}

/** Types that carry no credential-specific meaning and must be ignored when matching. */
const GENERIC_TYPES = new Set(['VerifiableCredential', 'VerifiableAttestation']);

/**
 * Resolves a legacy credential's `type[]` to a metadata configuration by matching
 * the specific (non-generic) type against each config's `credential_definition.type`,
 * and picking the highest version among the matches.
 *
 * Returns null when nothing matches (caller keeps its existing behaviour).
 */
export function matchLegacyConfig(
  vcTypes: readonly string[] | undefined,
  allConfigs: Record<string, CredentialConfigurationDto> | null | undefined,
): LegacyConfigMatch | null {
  if (!vcTypes?.length || !allConfigs) {
    return null;
  }

  const specificTypes = vcTypes.filter(t => !!t && !GENERIC_TYPES.has(t));
  if (specificTypes.length === 0) {
    return null;
  }

  let best: LegacyConfigMatch | null = null;
  let bestVersion = -Infinity;

  for (const [configId, config] of Object.entries(allConfigs)) {
    const declaredTypes = config.credential_definition?.type ?? [];
    const declaresLegacyType = declaredTypes.some(t => specificTypes.includes(t));
    if (!declaresLegacyType) {
      continue;
    }

    const version = parseConfigVersion(configId);
    if (version > bestVersion) {
      bestVersion = version;
      best = { configId, config };
    }
  }

  return best;
}

/**
 * Returns a normalized COPY of a legacy credential so the standard schema
 * builder and renderers work unchanged. Idempotent on modern-shaped data.
 */
export function normalizeLegacyCredential<T>(vc: T): T {
  if (!vc || typeof vc !== 'object') {
    return vc;
  }

  // Plain-JSON deep clone — the credential is signed data, never mutate the original.
  const clone = JSON.parse(JSON.stringify(vc));
  const mandate = clone?.credentialSubject?.mandate;

  if (mandate) {
    if (Array.isArray(mandate.power)) {
      mandate.power = mandate.power.map(normalizePower);
    }

    const mandator = mandate.mandator;
    if (mandator && mandator.email == null && mandator.emailAddress != null) {
      mandator.email = mandator.emailAddress;
    }
  }

  return clone as T;
}

/** Extracts the trailing numeric version from a config id (e.g. "...w3c.3" -> 3). */
function parseConfigVersion(configId: string): number {
  const lastSegment = configId.split('.').pop();
  const version = Number(lastSegment);
  return Number.isFinite(version) ? version : 0;
}

/** Maps DOME v1 `tmf_*` power keys onto the current `domain` / `function` / `action` keys. */
function normalizePower(power: unknown): unknown {
  if (!power || typeof power !== 'object') {
    return power;
  }

  const p = { ...(power as Record<string, unknown>) };
  if (p['domain'] == null && p['tmf_domain'] != null) {
    p['domain'] = p['tmf_domain'];
  }
  if (p['function'] == null && p['tmf_function'] != null) {
    p['function'] = p['tmf_function'];
  }
  if (p['action'] == null && p['tmf_action'] != null) {
    p['action'] = p['tmf_action'];
  }
  return p;
}
