/**
 * Reading and applying the issuance UI policy — pure, source-agnostic.
 *
 * Nothing here knows where the document came from. `parseIssuanceUiPolicyDocument` turns one
 * published document into the policy of ONE tenant; `policyAllowsConfiguration` answers the
 * only question the rest of the app asks of it.
 *
 * Keeping both free of Angular and of HTTP is what makes the source swappable: changing where
 * the policy is published is a rewrite of `core/services/issuance-ui-policy.loader.ts`, and
 * this file does not move.
 */

import { parseCredentialConfigurationId } from './credential-configuration-id';
import { IssuanceUiPolicy } from '../models/issuance-ui-policy.model';

/**
 * Resolves `tenant`'s policy out of a published document.
 *
 * Returns `null` — meaning "the document is unusable, fail closed" — when:
 *
 * - it is not an object;
 * - neither `tenants[tenant]` nor `default` carries an `allowedCredentials` array;
 * - the array carried entries but none of them survived normalization, which is a document
 *   someone wrote wrong rather than a tenant that issues nothing.
 *
 * A tenant entry that exists WINS over `default`, including when it is an empty list: a
 * tenant that must not issue anything from the UI says so by writing `[]`, and that is not
 * the same as saying nothing.
 */
export function parseIssuanceUiPolicyDocument(raw: unknown, tenant: string): IssuanceUiPolicy | null {
  if (!isRecord(raw)) {
    return null;
  }

  const entry = tenantEntry(raw['tenants'], tenant) ?? raw['default'];

  if (!isRecord(entry) || !Array.isArray(entry['allowedCredentials'])) {
    return null;
  }

  const declared = entry['allowedCredentials'];
  const allowedCredentials = normalize(declared);

  // Declared-but-all-invalid is a broken document; declared-as-empty is a real policy.
  if (declared.length > 0 && allowedCredentials.length === 0) {
    return null;
  }

  return { allowedCredentials };
}

/**
 * Whether the UI may offer `configurationId`.
 *
 * An allow-list entry is a LINEAGE — the configuration id minus its trailing version — so the
 * comparison is an equality between lineages, not a prefix test: `learcredential.employee.w3c`
 * covers every version of that type in that format and nothing else. `learcredential.employee`
 * on its own matches nothing, because the format is part of the identity of what is allowed.
 *
 * An id that does not carry a version is never allowed. It cannot be shown to be the current
 * anything, and `keepLatestCredentialConfigurations` drops it downstream regardless.
 *
 * TEMPORARY (see `issuance-ui-policy.model.ts` for the full note): the entry carries no
 * version because the metadata is trusted to always declare the current version of a lineage
 * a tenant can still issue, leaving the choice of version to
 * `keepLatestCredentialConfigurations`. If the issuer ever publishes a lineage whose newest
 * declared version is a superseded one, this is where a version floor would go.
 */
export function policyAllowsConfiguration(policy: IssuanceUiPolicy, configurationId: string): boolean {
  const parsed = parseCredentialConfigurationId(configurationId.trim());
  if (!parsed) {
    return false;
  }

  return policy.allowedCredentials.includes(parsed.lineage);
}

/** The entry declared for `tenant`, or `undefined` when there is none to read. */
function tenantEntry(tenants: unknown, tenant: string): unknown {
  if (!tenant || !isRecord(tenants)) {
    return undefined;
  }
  return tenants[tenant];
}

/**
 * Trims, drops non-strings and blanks, and removes duplicates.
 *
 * Lenient on the items rather than on the array: a stray empty line in a hand-edited document
 * should not cost a tenant its policy, while an array that yields nothing usable is reported
 * as a broken document by the caller.
 */
function normalize(declared: readonly unknown[]): string[] {
  const cleaned = declared
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(item => item.length > 0);

  return [...new Set(cleaned)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
