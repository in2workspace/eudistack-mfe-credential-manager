import { IssuanceChannelResponse } from '../dto/lear-credential-issuance-request.dto';
import { DeliveryModeToken } from './lear-credential-issuance';

/**
 * What happened to one requested delivery channel, read off `responses[]` (EUD-233 AD-7):
 * - `'delivered'` -- a 2xx item for this channel carrying the artefact the channel is supposed to
 *   carry (for `direct`, a non-empty `signed_credential`; `ui`/`email` need only the 2xx).
 * - `'failed'` -- an item for this channel exists, but its status is not 2xx (RFC 9457 `error`).
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
 * Resolves the outcome of every requested delivery mode from one issuance response (EUD-233 AD-7),
 * replacing the AS-IS `hasChannelError()` -- which treated any `responses[].error` as a total failure
 * and hid whatever had already been delivered, in violation of FR-14.
 *
 * Every mode in `requestedModes` gets exactly one entry, whether or not `responses[]` mentions it:
 * a mode the operator asked for but that never made it into the envelope resolves to `'missing'`,
 * not to being silently dropped.
 *
 * Deliberately per-item: whether the overall HTTP response was 200 or 207 plays no part in this
 * function -- each channel's outcome comes only from its own item (EC-03). The fixed `direct` -> `ui`
 * -> `email` presentation order (`DELIVERY_RESULT_ORDER`) is applied by the caller, not here: this
 * function only resolves outcomes, it does not order them.
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
