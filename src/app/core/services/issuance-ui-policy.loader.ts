/**
 * THE ONLY PLACE THAT KNOWS WHERE THE ISSUANCE UI POLICY COMES FROM.
 *
 * Changing the source — a per-tenant `theme.json` once EUD-217 migrates branding, an issuer
 * endpoint, anything else — means rewriting the body of `loadIssuanceUiPolicy` and nothing
 * else in the application: the signature below is the contract, and it is expressed in domain
 * terms (`IssuanceUiPolicy`), not in the shape of any particular document.
 *
 * INVARIANT: no other file in this feature imports `HttpClient`. It is the whole reason the
 * swap stays cheap, and it is verifiable with a grep.
 */

import { HttpClient } from '@angular/common/http';
import { map, Observable, retry, timer, timeout } from 'rxjs';
import {
  ISSUANCE_UI_POLICY_RETRY_BACKOFF_MS,
  ISSUANCE_UI_POLICY_RETRY_COUNT,
  ISSUANCE_UI_POLICY_TIMEOUT_MS,
  ISSUANCE_UI_POLICY_URL,
} from '../constants/issuance-ui-policy.constants';
import { parseIssuanceUiPolicyDocument } from '../helpers/issuance-ui-policy';
import { IssuanceUiPolicy } from '../models/issuance-ui-policy.model';

/**
 * Resolves the policy published for `tenant`.
 *
 * Emits `null` when the document is readable but unusable for this tenant (no entry and no
 * `default`, malformed shape). Errors (404, 5xx, network, timeout after retries) are
 * propagated so the caller can tell them apart in a log; both end at the same fail-closed
 * outcome in `IssuanceUiPolicyService`.
 *
 * The timeout sits BEFORE the retry so it applies per attempt: three tries of 800 ms with a
 * 300/600 ms backoff, rather than one 800 ms budget for the lot.
 */
export function loadIssuanceUiPolicy(http: HttpClient, tenant: string): Observable<IssuanceUiPolicy | null> {
  return http.get<unknown>(ISSUANCE_UI_POLICY_URL).pipe(
    timeout(ISSUANCE_UI_POLICY_TIMEOUT_MS),
    retry({
      count: ISSUANCE_UI_POLICY_RETRY_COUNT,
      delay: (_error, attempt) => timer(attempt * ISSUANCE_UI_POLICY_RETRY_BACKOFF_MS),
    }),
    map(document => parseIssuanceUiPolicyDocument(document, tenant)),
  );
}
