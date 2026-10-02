import { HttpErrorResponse } from '@angular/common/http';
import { REFRESH_PROBLEM_TYPE, resolveRefreshErrorState } from './credential-offer-refresh-error';

function httpError(status: number, error: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error });
}

describe('resolveRefreshErrorState', () => {
  it('should resolve to revoked on 410 + credential_offer_gone', () => {
    const error = httpError(410, {
      type: 'credential_offer_gone',
      title: 'Credential offer gone',
      status: 410,
      detail: 'This credential offer can no longer be refreshed',
      instance: '2c5f74d6-66cc-4ff1-bb8a-7604232f75e7'
    });

    expect(resolveRefreshErrorState(error)).toBe('revoked');
  });

  it('should not resolve to revoked when credential_offer_gone comes with a status other than 410', () => {
    expect(resolveRefreshErrorState(httpError(400, { type: REFRESH_PROBLEM_TYPE.CREDENTIAL_OFFER_GONE }))).toBe('error');
    expect(resolveRefreshErrorState(httpError(500, { type: REFRESH_PROBLEM_TYPE.CREDENTIAL_OFFER_GONE }))).toBe('error');
  });

  it('should ignore title and detail, relying only on status and type', () => {
    const error = httpError(410, {
      type: 'OFFER_EXPIRED',
      title: 'Credential offer gone',
      detail: 'This credential offer can no longer be refreshed'
    });

    expect(resolveRefreshErrorState(error)).toBe('error');
  });

  it('should be case-sensitive on the problem type', () => {
    expect(resolveRefreshErrorState(httpError(410, { type: 'CREDENTIAL_OFFER_GONE' }))).toBe('error');
  });

  it.each([410, 409, 500])('should resolve to already-active on CREDENTIAL_ALREADY_ACTIVE regardless of status (%s)', status => {
    expect(resolveRefreshErrorState(httpError(status, { type: REFRESH_PROBLEM_TYPE.CREDENTIAL_ALREADY_ACTIVE })))
      .toBe('already-active');
  });

  it.each([
    ['a 410 with another problem type', httpError(410, { type: 'OFFER_EXPIRED', status: 410 })],
    ['a 410 without body', httpError(410, null)],
    ['a 410 with a plain-text body', httpError(410, 'Gone')],
    ['a 404', httpError(404, { type: 'NOT_FOUND', status: 404 })],
    ['a 500', httpError(500, 'Internal Server Error')],
    ['a network failure', httpError(0, new ProgressEvent('error'))],
    ['a non-HTTP error', new Error('boom')],
    ['an undefined error', undefined],
  ])('should resolve to the generic error state on %s', (_label, error) => {
    expect(resolveRefreshErrorState(error)).toBe('error');
  });
});
