/**
 * Which credentials the ISSUANCE UI offers a form for, per tenant.
 *
 * This is a UI concern, deliberately kept out of the backend: the issuer already decides what
 * a tenant MAY issue (`tenant_credential_profile` -> `credential_configurations_supported`),
 * and the API can issue every one of those. The UI offers a NARROWER set, because some
 * credentials are meant to be issued through the API only. The issuer must not have to know
 * that.
 *
 * See `core/helpers/issuance-ui-policy.ts` for the matching rule and
 * `core/services/issuance-ui-policy.loader.ts` for where the document comes from.
 */

/** The policy already resolved for ONE tenant — the shape the rest of the app consumes. */
export interface IssuanceUiPolicy {
  /**
   * Lineages — `<type>.<format-family>`, the whole configuration id MINUS its trailing
   * version (`learcredential.employee.w3c`, `learcredential.machine.sd`). The format is part
   * of the identity, so allowing a type in one format says nothing about the others.
   *
   * An empty list is a valid policy, not a missing one: it means this tenant issues
   * exclusively through the API.
   */
  readonly allowedCredentials: readonly string[];
}

/**
 * One entry of the published document: the `default` block, or a per-tenant override.
 *
 * Deliberately `unknown` rather than `string[]`: this comes off the network, and
 * `http.get<T>()` is a TypeScript cast with no runtime check behind it. Everything is
 * validated in `parseIssuanceUiPolicyDocument` before it becomes an `IssuanceUiPolicy`.
 */
export interface IssuanceUiPolicyEntryDto {
  readonly allowedCredentials?: unknown;
}

/**
 * Wire shape of `/assets/tenants/issuance-ui.json`:
 *
 * ```json
 * {
 *   "default": {
 *     "allowedCredentials": [
 *       "learcredential.employee.w3c",
 *       "learcredential.employee.sd",
 *       "learcredential.machine.w3c"
 *     ]
 *   },
 *   "tenants": {
 *     "kpmg": { "allowedCredentials": ["learcredential.employee.sd"] }
 *   }
 * }
 * ```
 *
 * A tenant with no entry falls back to `default`, so the common case costs nothing to
 * maintain and only the exceptions are written down. A tenant that exists but has no entry
 * AND no `default` to fall back on is a misconfiguration, not an empty policy.
 *
 * TEMPORARY, tied to a backend limitation — entries carry NO version segment.
 * -------------------------------------------------------------------------
 * Which VERSION of an allowed lineage is offered is decided downstream by
 * `keepLatestCredentialConfigurations`, i.e. "the newest the metadata declares". That is only
 * safe while `credential_configurations_supported` always carries the current version of
 * anything a tenant can still issue. It carries superseded versions too — the details screen
 * needs them to resolve credentials already issued under them — so the day a tenant's
 * metadata could hold ONLY a superseded version of a lineage, "the newest declared" would be
 * that superseded one and the form would offer it. This is the same coupling that
 * `pinned-issuable-versions.ts` used to work around with a hardcoded global floor.
 *
 * When the issuer separates the read catalogue from the set of issuance-enabled
 * configurations, nothing here needs to change. If instead that guarantee ever breaks before
 * then, the fix is to let an entry carry a version as a FLOOR (`learcredential.employee.w3c.4`
 * = "v4 or newer") and to collapse duplicate lineages in the document to the highest floor —
 * the pinned-versions algorithm, but fed per tenant from this document instead of from code.
 */
export interface IssuanceUiPolicyDocumentDto {
  readonly default?: unknown;
  readonly tenants?: unknown;
}
