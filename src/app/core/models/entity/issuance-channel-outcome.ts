import { IssuanceChannelResponse } from '../dto/lear-credential-issuance-request.dto';
import { DeliveryModeToken } from './lear-credential-issuance';

/**
 * What happened to the requested delivery channel, read off `responses[]` (EUD-233 AD-7). Since
 * EUD-268 the request carries a single mode and a success is always 200 with that one item; a failed
 * delivery is an error response, not an item, so in practice only `'delivered'` and `'missing'` occur:
 * - `'delivered'` -- a 2xx item for this channel carrying the artefact the channel is supposed to
 *   carry (for `direct`, a non-empty `signed_credential`; `ui`/`email` need only the 2xx).
 * - `'failed'` -- defensive: an item for this channel exists, but its status is not 2xx.
 * - `'missing'` -- either no item for this channel exists in `responses[]` at all, or (defensive,
 *   ES-02) the `direct` item is 2xx but carries no `signed_credential` -- a 2xx with no artefact is
 *   not a delivery, so it is not `'delivered'`, and it is not an RFC 9457 error either, so it is not
 *   `'failed'`.
 */
export type ChannelOutcome = 'delivered' | 'failed' | 'missing';

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function resolveOutcome(mode: DeliveryModeToken, response: IssuanceChannelResponse | undefined): ChannelOutcome {
  if (!response) {
    return 'missing';
  }
  if (!isSuccessStatus(response.status)) {
    return 'failed';
  }
  if (mode === 'direct' && !response.body?.signed_credential) {
    return 'missing';
  }
  return 'delivered';
}

/**
 * Resolves the outcome of the requested delivery mode from one issuance response (EUD-233 AD-7).
 * Since EUD-268 `requestedModes` holds the one mode the form sent.
 *
 * Every mode in `requestedModes` gets exactly one entry, whether or not `responses[]` mentions it:
 * a mode the operator asked for but that never made it into the envelope resolves to `'missing'`,
 * not to being silently dropped.
 */
export function resolveChannelOutcomes(
  responses: readonly IssuanceChannelResponse[],
  requestedModes: readonly DeliveryModeToken[]
): ReadonlyMap<DeliveryModeToken, ChannelOutcome> {
  const outcomes = new Map<DeliveryModeToken, ChannelOutcome>();

  for (const mode of requestedModes) {
    const response = responses.find(candidate => candidate.channel === mode);
    outcomes.set(mode, resolveOutcome(mode, response));
  }

  return outcomes;
}
