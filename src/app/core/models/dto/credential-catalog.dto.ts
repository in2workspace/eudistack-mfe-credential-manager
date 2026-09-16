/**
 * One entry of the tenant credential catalog, as returned by
 * `GET /api/v1/backoffice/credential-catalog` (EUD-169). The backend returns *every* type of the
 * global registry, each with the `enabled` flag for the current tenant.
 *
 * `displayName` falls back to `credentialConfigurationId` when the credential profile carries no
 * display name -- the backend does not localize it (EUD-72, D4).
 *
 * `deliveryModes` and `schemaEligibleModes` are typed **optional** on purpose, even though an
 * EUD-169 Issuer always sends both: the type models the deployment environment, not only the target
 * contract (EUD-233 AD-9). Read together with `enabled`, the shape can represent all four catalogue
 * states this Story resolves:
 *
 * - **State 1** (tenant configured, or never configured -- the backend already resolved the
 *   schema ceiling): `deliveryModes` present and non-empty.
 * - **State 2** (Issuer predates EUD-169): `deliveryModes` `undefined` -- absent from the response,
 *   not an empty array. Degrades to the wallet-only, schema-derived catalogue (EC-10).
 * - **State 3** (tenant restricted this type to zero modes): `deliveryModes` present and `[]`, only
 *   meaningful when `enabled: true` (AC-11).
 * - **State 4** (the whole `GET` is unreadable): not representable by a single entry -- it is a
 *   property of the read itself, resolved by `DeliveryEligibilitySnapshot` (EUD-233 task 3), not by
 *   this DTO.
 */
export interface CredentialCatalogEntry {
  credentialConfigurationId: string;
  displayName: string;
  enabled: boolean;
  deliveryModes?: string[];
  schemaEligibleModes?: string[];
}
