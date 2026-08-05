/**
 * TEMPORARY — HARDCODED VERSION FLOOR FOR ISSUANCE.
 *
 * The issuer metadata (`credential_configurations_supported`) serves two purposes at once:
 * it decides what the issuance form may offer, AND it resolves the definition of credentials
 * that were already issued (the details screen reads it through
 * `CredentialIssuerMetadataService.getConfigurationById()` / `getAllConfigurations()`).
 *
 * Those two purposes pull in opposite directions:
 *
 * - Removing `learcredential.employee.w3c.4` to stop issuing it also makes every credential
 *   issued under it unrenderable.
 * - Declaring `learcredential.employee.w3c.1` so old credentials still render puts that
 *   version back in the issuance form.
 *
 * `keepLatestCredentialConfigurations` only knows a RELATIVE rule ("the newest of the ones
 * present"), so a metadata carrying nothing but `...w3c.1` makes v1 the newest and the form
 * offers it. This module adds the ABSOLUTE floor that relative rule cannot express: which
 * version of each lineage is the current one, regardless of what else is declared.
 *
 * HOW TO REMOVE (in one step, once the backend separates the read catalog from the set of
 * issuance-enabled configurations):
 *
 *   1. Delete this file and its spec.
 *   2. In `core/services/credential-issuer-metadata.service.ts`, drop the import and unwrap
 *      the single call marked `PINNED-VERSIONS`.
 *
 * Nothing else depends on it. In particular the details screen never passes through here,
 * so superseded versions stay resolvable by id whatever this module says.
 */

import { parseCredentialConfigurationId } from './credential-configuration-id';

/**
 * Lineage (`<type>.<format-family>`, see `credential-configuration-id.ts`) -> the version
 * considered current for issuance.
 *
 * Only lineages that actually have superseded versions in the wild are listed. Every other
 * credential type is still on v1, so listing them would add maintenance for no effect.
 */
export const PINNED_LATEST_VERSION_BY_LINEAGE: Readonly<Record<string, number>> = {
  'learcredential.employee.w3c': 4,
  'learcredential.machine.w3c': 3,
};

/**
 * Whether `configId` is current enough to be offered for issuance.
 *
 * - A lineage that is NOT pinned always passes: this is a floor for known-legacy lineages,
 *   not an allowlist. Turning it into an allowlist would silently hide any type added to the
 *   metadata after this file was written.
 * - `>=` and not `===` so a future v5 is offered without touching this file;
 *   `keepLatestCredentialConfigurations` still narrows the survivors down to the highest one.
 * - An id carrying no version passes: it says nothing about lineages, and the relative filter
 *   downstream drops unversioned ids anyway. Deciding it here would duplicate that policy.
 */
export function isPinnedIssuableVersion(configId: string): boolean {
  const parsed = parseCredentialConfigurationId(configId);
  if (!parsed) {
    return true;
  }

  const pinnedVersion = PINNED_LATEST_VERSION_BY_LINEAGE[parsed.lineage];
  return pinnedVersion === undefined || parsed.version >= pinnedVersion;
}

/**
 * `isPinnedIssuableVersion` over a list, preserving order.
 *
 * Generic over the item, and shaped like `keepLatestCredentialConfigurations`, so the two
 * compose at the call site without adapters.
 */
export function keepPinnedIssuableVersions<T>(
  items: readonly T[],
  idOf: (item: T) => string,
): T[] {
  return items.filter(item => isPinnedIssuableVersion(idOf(item)));
}
