/**
 * One entry of the tenant credential catalog, as returned by
 * `GET /admin/v1/credential-catalog`. The backend returns *every* type of the global
 * registry, each with the `enabled` flag for the current tenant.
 *
 * `displayName` falls back to `credentialConfigurationId` when the credential profile
 * carries no display name — the backend does not localize it (EUD-72, D4).
 */
export interface CredentialCatalogEntry {
  credentialConfigurationId: string;
  displayName: string;
  enabled: boolean;
}

/**
 * Body of `PUT /admin/v1/credential-catalog`. Replace-all semantics: the set sent here
 * becomes the whole enabled set for the tenant.
 *
 * An empty array is NOT "nothing enabled": the backend deletes the tenant configuration
 * and the `empty = all enabled` invariant kicks back in (EC-01). The UI warns about it;
 * the invariant itself lives in the backend.
 */
export interface UpdateCredentialCatalogRequest {
  enabledConfigurationIds: string[];
}
