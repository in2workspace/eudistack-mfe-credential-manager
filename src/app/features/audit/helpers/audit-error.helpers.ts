import { HttpErrorResponse } from '@angular/common/http';

export interface AuditErrorMessage {
  /** i18n key of the message. */
  key: string;
  params?: { seconds: number };
  /** The session is no longer valid: the section offers to sign in again. */
  sessionExpired: boolean;
}

const SESSION_EXPIRED: AuditErrorMessage = { key: 'audit.error.session_expired', sessionExpired: true };
const NO_ACCESS: AuditErrorMessage = { key: 'audit.error.no_access', sessionExpired: false };
const GENERIC: AuditErrorMessage = { key: 'audit.error.generic', sessionExpired: false };

/**
 * The message for an error of the audit API: its RFC 9457 `type` decides (PRD EUD-331 §5), with the
 * status as the fallback for the two that carry a wait or a re-login (401 and 429) when no body came.
 */
export function toAuditErrorMessage(error: unknown): AuditErrorMessage {
  const response = error instanceof HttpErrorResponse ? error : null;
  switch (response?.error?.type) {
    case 'period_archived':
      return { key: 'audit.error.period_archived', sessionExpired: false };
    case 'BAD_REQUEST':
      return { key: 'audit.error.bad_request', sessionExpired: false };
    case 'insufficient_permission':
    case 'tenant_mismatch':
    case 'tenant_not_resolved':
      return NO_ACCESS;
    case 'invalid_token':
    case 'authentication_error':
      return SESSION_EXPIRED;
    case 'rate_limited':
      return rateLimited(response);
    default:
      return fromStatus(response);
  }
}

function fromStatus(response: HttpErrorResponse | null): AuditErrorMessage {
  if (response?.status === 401) {
    return SESSION_EXPIRED;
  }
  if (response?.status === 429) {
    return rateLimited(response);
  }
  return GENERIC;
}

function rateLimited(response: HttpErrorResponse): AuditErrorMessage {
  const seconds = Number.parseInt(response.headers?.get('Retry-After') ?? '', 10);
  return Number.isFinite(seconds) && seconds > 0
    ? { key: 'audit.error.rate_limited', params: { seconds }, sessionExpired: false }
    : { key: 'audit.error.rate_limited_short', sessionExpired: false };
}
