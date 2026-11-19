import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { toAuditErrorMessage } from './audit-error.helpers';

const problem = (type: string, status: number, headers?: Record<string, string>): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { type }, headers: new HttpHeaders(headers) });

// The table of PRD EUD-331 §5: what the API answers, and the message the auditor reads.
describe('toAuditErrorMessage', () => {

  it.each([
    ['period_archived', 409, 'audit.error.period_archived'],
    ['BAD_REQUEST', 400, 'audit.error.bad_request'],
    ['insufficient_permission', 403, 'audit.error.no_access'],
    ['tenant_mismatch', 403, 'audit.error.no_access'],
    ['tenant_not_resolved', 403, 'audit.error.no_access'],
    ['invalid_token', 401, 'audit.error.session_expired'],
    ['authentication_error', 401, 'audit.error.session_expired'],
  ])('maps %s (status %s) to %s', (type, status, key) => {
    expect(toAuditErrorMessage(problem(type, status)).key).toBe(key);
  });

  it('asks to sign in again only when the session is no longer valid', () => {
    expect(toAuditErrorMessage(problem('invalid_token', 401)).sessionExpired).toBe(true);
    expect(toAuditErrorMessage(problem('authentication_error', 401)).sessionExpired).toBe(true);
    expect(toAuditErrorMessage(problem('insufficient_permission', 403)).sessionExpired).toBe(false);
  });

  describe('rate_limited', () => {
    it('carries the seconds the API asks to wait', () => {
      const message = toAuditErrorMessage(problem('rate_limited', 429, { 'Retry-After': '37' }));

      expect(message).toEqual({ key: 'audit.error.rate_limited', params: { seconds: 37 }, sessionExpired: false });
    });

    it('says "a few seconds" when the API sends no valid wait', () => {
      expect(toAuditErrorMessage(problem('rate_limited', 429)).key).toBe('audit.error.rate_limited_short');
      expect(toAuditErrorMessage(problem('rate_limited', 429, { 'Retry-After': 'soon' })).key)
        .toBe('audit.error.rate_limited_short');
      expect(toAuditErrorMessage(problem('rate_limited', 429, { 'Retry-After': '0' })).key)
        .toBe('audit.error.rate_limited_short');
    });
  });

  describe('without a known type', () => {
    it('treats a 401 as an expired session', () => {
      expect(toAuditErrorMessage(new HttpErrorResponse({ status: 401 }))).toEqual(
        { key: 'audit.error.session_expired', sessionExpired: true });
    });

    it('treats a 429 as rate limiting, reading the wait from the header', () => {
      const error = new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '5' }) });

      expect(toAuditErrorMessage(error).params).toEqual({ seconds: 5 });
    });

    it.each([0, 404, 500, 503])('shows the generic message for status %s', status => {
      expect(toAuditErrorMessage(new HttpErrorResponse({ status, error: { type: 'service_unavailable' } })).key)
        .toBe('audit.error.generic');
    });

    it('shows the generic message for something that is not an HTTP error', () => {
      expect(toAuditErrorMessage(new Error('boom')).key).toBe('audit.error.generic');
      expect(toAuditErrorMessage(undefined).key).toBe('audit.error.generic');
    });

    it('survives a body that is not an object', () => {
      expect(toAuditErrorMessage(new HttpErrorResponse({ status: 500, error: 'plain text' })).key)
        .toBe('audit.error.generic');
    });
  });
});
