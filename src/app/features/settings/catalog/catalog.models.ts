/**
 * Re-exported from `core/models/dto/credential-catalog.dto.ts` (EUD-233 AD-2): the `GET` this shape
 * describes now has one canonical adapter, `core/services/credential-catalog.service.ts`, consumed
 * both by this screen and by the issuance form. Kept as a re-export rather than an import-and-use at
 * every call site so this feature's own files do not need to change their import path.
 */
import type { CredentialCatalogEntry } from 'src/app/core/models/dto/credential-catalog.dto';
export type { CredentialCatalogEntry };

/**
 * One rendered row: a catalog entry plus the format and version read off its id.
 *
 * `displayName` alone is not enough to tell rows apart. Two configurations of the same
 * credential type in different formats can carry the SAME display name
 * (`learcredential.employee.w3c.2` and `learcredential.employee.sd.1` are both
 * "LEAR Credential Employee"), which would leave the admin with two identical-looking
 * toggles — and two identical accessible names.
 */
export interface CredentialCatalogRow extends CredentialCatalogEntry {
  /** Format token from the id (`w3c`, `sd`). Shown as-is when no label key covers it. */
  readonly formatFamily: string;
  /** i18n key for `formatFamily`, or null when the token is unknown to the UI. */
  readonly formatLabelKey: string | null;
  readonly version: number;
}

/**
 * Format token in a configuration id -> i18n key naming that format.
 *
 * This mapping lives in the catalog feature rather than in core because only the catalog
 * needs it: `GET /api/v1/backoffice/credential-catalog` returns no `format` field, so the id is the
 * one signal available. The issuance form reads the authoritative `format` from the issuer
 * metadata instead and labels it through `FORMAT_LABEL_MAP`, so it must not come here.
 *
 * The keys are reused from `credentialIssuance.format.*` deliberately: these are product
 * names ("W3C VC Data Model v2.0", "SD-JWT VC") that must read identically on both screens.
 *
 * An unmapped token is NOT an error — the raw token is shown, so a new format the backend
 * introduces appears (unstyled but truthful) instead of vanishing.
 */
export const FORMAT_FAMILY_LABEL_KEYS: Readonly<Record<string, string>> = {
  w3c: 'credentialIssuance.format.w3cVcDm',
  sd: 'credentialIssuance.format.sdJwt',
  mdoc: 'credentialIssuance.format.mdoc'
};

/**
 * Body of `PUT /api/v1/backoffice/credential-catalog`. Replace-all semantics: the set sent here
 * becomes the whole enabled set for the tenant.
 *
 * An empty array is NOT "nothing enabled": the backend deletes the tenant configuration
 * and the `empty = all enabled` invariant kicks back in (EC-01). The UI warns about it;
 * the invariant itself lives in the backend.
 */
export interface UpdateCredentialCatalogRequest {
  enabledConfigurationIds: string[];
}
