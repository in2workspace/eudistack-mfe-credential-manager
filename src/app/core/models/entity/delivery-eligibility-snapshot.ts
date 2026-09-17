import { CredentialCatalogEntry } from '../dto/credential-catalog.dto';
import { DeliveryModeToken } from './lear-credential-issuance';

const DELIVERY_MODE_TOKENS: ReadonlySet<string> = new Set<DeliveryModeToken>(['direct', 'ui', 'email']);

/**
 * Narrows a wire string to a {@link DeliveryModeToken}. The catalogue DTO types `deliveryModes` as a
 * loose `string[]` because it is unvalidated wire data; this is the one place that data crosses into
 * the domain vocabulary, so it is filtered here rather than cast. An unrecognized token is dropped,
 * not an error: it lets the frontend degrade forward against a future backend token it does not yet
 * know how to render, instead of failing the whole read.
 */
function isDeliveryModeToken(value: string): value is DeliveryModeToken {
  return DELIVERY_MODE_TOKENS.has(value);
}

/**
 * The result of resolving the tenant's delivery-mode catalogue for the current issuance form
 * (EUD-233 AD-9): either the read succeeded and each `credentialConfigurationId` maps to its offerable
 * modes, or the whole read failed and nothing can be resolved.
 *
 * `modesByConfigId.get(configId)` distinguishes the three per-type states a *successful* read can
 * still produce:
 * - `undefined` -- **state 2**: no data for this type (Issuer predates EUD-169, or the entry is
 *   absent from the array, or it is disabled). Callers fall back to the schema-derived,
 *   wallet-only catalogue (`resolveOfferableDeliveryOptions` over `WALLET_DELIVERY_MODE_OPTIONS`).
 * - `[]` -- **state 3**: the tenant restricted this type to zero modes. Callers retire the type
 *   from the offerable list; this snapshot only carries the data, it does not warn or filter.
 * - a non-empty array -- **state 1**: the modes to offer, literally, no further derivation.
 *
 * **State 4** (the whole catalogue is unreadable) is not a per-type case: it is `status: 'unreadable'`,
 * because no entry data exists to key by `configId` at all.
 */
export type DeliveryEligibilitySnapshot =
  | { readonly status: 'read'; readonly modesByConfigId: ReadonlyMap<string, readonly DeliveryModeToken[]> }
  | { readonly status: 'unreadable' };

/**
 * Collapses one read of `GET /api/v1/backoffice/credential-catalog` into a
 * {@link DeliveryEligibilitySnapshot} (EUD-233 AD-9).
 *
 * `entries === undefined` stands for the whole read failing -- any non-2xx status (including the 404
 * `credential_catalog_not_configured`), a network error, or a timeout. This function has no HTTP
 * awareness on purpose: the adapter that calls it (`CredentialCatalogService.loadDeliveryEligibility()`)
 * is the one place that collapses every failure shape into `undefined` before calling in here, so this
 * resolver only ever has to reason about "did the read work or not".
 *
 * Two defensive rules, not asserted by any single AC but required for the four states to be
 * exhaustive and safe:
 * - An entry whose `deliveryModes` field is itself `undefined`, and a `credentialConfigurationId`
 *   missing from `entries` entirely, resolve to the exact same thing: no map entry, i.e. state 2 for
 *   that type. Retiring a type by *absence* would infer a vacancy nobody affirmed.
 * - Disabled entries (`enabled: false`) are skipped outright: they are already excluded from the
 *   offerable type list by the mechanism that predates this Story, and warning about them would drown
 *   the AC-11 diagnostic signal in noise.
 */
export function resolveDeliveryEligibility(
  entries: readonly CredentialCatalogEntry[] | undefined
): DeliveryEligibilitySnapshot {
  if (entries === undefined) {
    return { status: 'unreadable' };
  }

  const modesByConfigId = new Map<string, readonly DeliveryModeToken[]>();
  for (const entry of entries) {
    if (!entry.enabled) {
      continue;
    }
    if (entry.deliveryModes === undefined) {
      continue;
    }
    modesByConfigId.set(entry.credentialConfigurationId, entry.deliveryModes.filter(isDeliveryModeToken));
  }

  return { status: 'read', modesByConfigId };
}
