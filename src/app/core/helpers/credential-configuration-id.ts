/**
 * Reading and version selection over credential configuration ids.
 *
 * Issuer configuration ids follow `<type>.<format-family>.<version>`:
 *
 *   learcredential.employee.w3c.1     learcredential.employee.sd.1
 *   learcredential.employee.w3c.2     learcredential.machine.w3c.3
 *   gx.labelcredential.w3c.1
 *
 * Everything before the trailing number is the *lineage*: the credential type together
 * with its format family. Two lineages are independent, so `...employee.w3c.2` supersedes
 * `...employee.w3c.1` but never `...employee.sd.1` — the format is part of the identity of
 * the thing being versioned, not a variant of it.
 *
 * Consumers (catalog screen today, issuance form next) only ever offer the newest version
 * of each lineage. Keeping that rule here means both screens agree on "newest" by
 * construction instead of by two parallel implementations.
 *
 * NOTE — `features/credential-details/legacy/legacy-credential-support.ts` parses versions
 * too, and deliberately does NOT use this module: it is documented as temporary and
 * self-contained so it can be deleted in one step, and it applies a different policy
 * (unversioned ids fall back to version 0 and still compete). Coupling it here would make
 * that removal harder for no gain.
 */

/** A configuration id decomposed into its meaningful parts. */
export interface ParsedCredentialConfigurationId {
  /** The id itself, unchanged. */
  readonly id: string;
  /** Type + format family — everything before the trailing version (`learcredential.employee.w3c`). */
  readonly lineage: string;
  /**
   * The format segment (`learcredential.employee.w3c.2` -> `w3c`).
   *
   * Structural only: this is the token the id uses, NOT an OID4VCI format string. Turning
   * `w3c` into something a user reads is the caller's job — the issuer metadata declares an
   * authoritative `format` per configuration, and screens that have it should prefer it.
   */
  readonly formatFamily: string;
  /** The trailing version number (`learcredential.employee.w3c.2` -> 2). */
  readonly version: number;
}

/**
 * Trailing digits after a dot, with at least one character of lineage in front.
 *
 * `.+` is greedy, so only the LAST dot-separated segment is read as the version:
 * `learcredential.employee.w3c.1` splits into `learcredential.employee.w3c` + `1`.
 *
 * Digits only, rather than `Number(segment)`: `Number('')` is 0, `Number(' 2 ')` is 2 and
 * `Number('1e3')` is 1000, so a loose parse would invent versions for ids that do not
 * carry one.
 */
const VERSIONED_CONFIGURATION_ID = /^(.+)\.(\d+)$/;

/**
 * Splits a configuration id into lineage, format family and version.
 *
 * Returns `null` when the id carries no trailing version (`learcredential.employee.w3c`,
 * or a legacy name such as `LEAR_CREDENTIAL_EMPLOYEE`). Callers decide what an
 * unversioned id means to them; `keepLatestCredentialConfigurations` drops them.
 */
export function parseCredentialConfigurationId(id: string): ParsedCredentialConfigurationId | null {
  const match = VERSIONED_CONFIGURATION_ID.exec(id);
  if (!match) {
    return null;
  }

  const lineage = match[1];
  // Degenerate ids with a single lineage segment ("foo.1") report that segment as the family.
  // Real ids always carry `<type>.<format>.<version>`, so there is nothing better to say.
  const formatFamily = lineage.slice(lineage.lastIndexOf('.') + 1);

  return { id, lineage, formatFamily, version: Number(match[2]) };
}

/**
 * Keeps, for each lineage, only the item with the highest version.
 *
 * Generic over the item so both shapes in play are covered without adapters: the catalog's
 * `CredentialCatalogEntry[]` (keyed by `credentialConfigurationId`) and the issuer
 * metadata's `Object.entries(credential_configurations_supported)` (keyed by the record key).
 *
 * - Items whose id carries no version are DROPPED, not passed through: an id that does not
 *   follow the versioning grammar cannot be shown to be the newest of anything, and the
 *   screens using this must only ever offer the newest.
 * - Relative input order is preserved, and the surviving item sits where its lineage first
 *   appeared. The catalog API sorts by display name and the metadata record has its own
 *   declaration order; neither should be reshuffled by filtering.
 * - On a duplicate version within a lineage the first occurrence wins, so the result is
 *   stable rather than dependent on iteration luck.
 */
export function keepLatestCredentialConfigurations<T>(
  items: readonly T[],
  idOf: (item: T) => string,
): T[] {
  /** Lineage -> position in `winners` + the version currently holding that slot. */
  const slotByLineage = new Map<string, { index: number; version: number }>();
  const winners: T[] = [];

  for (const item of items) {
    const parsed = parseCredentialConfigurationId(idOf(item));
    if (!parsed) {
      continue;
    }

    const slot = slotByLineage.get(parsed.lineage);
    if (!slot) {
      slotByLineage.set(parsed.lineage, { index: winners.length, version: parsed.version });
      winners.push(item);
      continue;
    }

    // Strictly greater: a tie keeps the incumbent, which is the earlier one.
    if (parsed.version > slot.version) {
      winners[slot.index] = item;
      slot.version = parsed.version;
    }
  }

  return winners;
}

/** `keepLatestCredentialConfigurations` for a bare list of ids. */
export function keepLatestCredentialConfigurationIds(ids: readonly string[]): string[] {
  return keepLatestCredentialConfigurations(ids, id => id);
}
