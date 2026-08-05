/**
 * TEMPORARY — This class is temporary while credentials are not distinguished per-tenant by the API.
 * 
 * Which credential types a tenant is allowed to SEE.
 *
 * Some credential types are specific to one tenant and must not appear in the other
 * tenants' screens even when the issuer registry declares them globally: Doctor ID belongs
 * to CGCOM, the Gaia-X Label credential to DOME.
 *
 * Two tenants are exempt and see the whole registry: `sandbox` and `platform` — the demo and
 * the operator tenants, where the point is to exercise every type.
 *
 * Reusable on purpose: the catalog screen filters its rows with this today, and the issuance
 * form will filter its type selector with it next, so a type can never be hidden on one
 * screen and offered on the other.
 *
 * ---
 * This is a UI restriction, not an authorization boundary. The issuer decides what a tenant
 * may actually issue; hiding a row here neither disables it for the tenant nor prevents a
 * crafted request. Treat it as presentation.
 */

import { parseCredentialConfigurationId } from './credential-configuration-id';

/** Tenants that see every credential type, restricted ones included. */
export const UNRESTRICTED_TENANTS: readonly string[] = ['sandbox', 'platform'];

/**
 * Credential type -> the only tenants allowed to see it.
 *
 * Keyed by the type portion of a configuration id, i.e. everything before the format
 * segment: `doctorid.sd.1` -> `doctorid`, `gx.labelcredential.w3c.2` -> `gx.labelcredential`.
 *
 * A type ABSENT from this map is visible to every tenant. Restrictions are opt-in so that a
 * new credential type is not accidentally invisible everywhere the day it ships.
 */
export const TENANT_RESTRICTED_CREDENTIAL_TYPES: Readonly<Record<string, readonly string[]>> = {
  doctorid: ['cgcom'],
  'gx.labelcredential': ['dome'],
  'learcredential.machine': ['dome'],
  'eu.europa': [], //only for unrestricted tenants
};

/**
 * Whether `tenant` may see the credential type behind `configurationId`.
 *
 * An empty or unknown tenant sees only the unrestricted types: tenant resolution failing is
 * not a reason to expose one organization's credential type to another.
 */
export function isCredentialTypeVisibleForTenant(configurationId: string, tenant: string): boolean {
  if (UNRESTRICTED_TENANTS.includes(tenant)) {
    return true;
  }

  const restrictedTo = restrictionFor(configurationId);
  return restrictedTo === null || restrictedTo.includes(tenant);
}

/**
 * Drops the items whose credential type is restricted away from `tenant`.
 *
 * Generic over the item and order-preserving, matching
 * `keepLatestCredentialConfigurations` so the two filters compose in either order.
 */
export function filterCredentialConfigurationsForTenant<T>(
  items: readonly T[],
  idOf: (item: T) => string,
  tenant: string,
): T[] {
  if (UNRESTRICTED_TENANTS.includes(tenant)) {
    return [...items];
  }
  return items.filter(item => isCredentialTypeVisibleForTenant(idOf(item), tenant));
}

/**
 * The tenant allowlist covering `configurationId`, or null when its type is unrestricted.
 *
 * Matching is on segment boundaries rather than a bare `startsWith`, so a future
 * `doctoridentity.w3c.1` is not silently caught by the `doctorid` restriction.
 */
function restrictionFor(configurationId: string): readonly string[] | null {
  const type = credentialTypeOf(configurationId);

  for (const [restrictedType, tenants] of Object.entries(TENANT_RESTRICTED_CREDENTIAL_TYPES)) {
    if (type === restrictedType || type.startsWith(`${restrictedType}.`)) {
      return tenants;
    }
  }
  return null;
}

/**
 * The type portion of a configuration id: the lineage minus its format segment.
 *
 * Ids that do not parse (no trailing version, or no format segment) are returned whole, so
 * they are matched against the restriction map as-is instead of being silently unrestricted.
 */
function credentialTypeOf(configurationId: string): string {
  const parsed = parseCredentialConfigurationId(configurationId);
  if (!parsed) {
    return configurationId;
  }

  const formatSuffix = `.${parsed.formatFamily}`;
  return parsed.lineage.endsWith(formatSuffix)
    ? parsed.lineage.slice(0, -formatSuffix.length)
    : parsed.lineage;
}
