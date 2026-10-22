import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';

/** Terminal outcomes the refresh screen can show when the POST fails. */
export type RefreshErrorState = 'unavailable' | 'error';

/**
 * Problem Details (RFC 7807) `type` values the refresh endpoint returns for functional
 * failures. Detection relies only on these and on the HTTP status — never on `title` or
 * `detail`, which are human-readable and may change or be localised.
 */
export const REFRESH_PROBLEM_TYPE = {
  CREDENTIAL_OFFER_GONE: 'credential_offer_gone',
} as const;

interface RefreshErrorRule {
  readonly state: Exclude<RefreshErrorState, 'error'>;
  readonly type: string;
  /** When set, the response status must also match. */
  readonly status?: HttpStatusCode;
}

// Evaluated in order; the first match wins. Anything unmatched falls back to the generic
// retryable 'error' state, so 410s with other (or no) problem types keep their behaviour.
const RULES: readonly RefreshErrorRule[] = [
  // The offer can no longer be refreshed because the credential has left DRAFT (issued,
  // revoked, withdrawn, expired...). The screen stays neutral about which.
  { state: 'unavailable', type: REFRESH_PROBLEM_TYPE.CREDENTIAL_OFFER_GONE, status: HttpStatusCode.Gone },
];

export function resolveRefreshErrorState(error: unknown): RefreshErrorState {
  if (!(error instanceof HttpErrorResponse)) {
    return 'error';
  }
  const type: unknown = error.error?.type;
  const rule = RULES.find(r => r.type === type && (r.status === undefined || r.status === error.status));
  return rule?.state ?? 'error';
}
