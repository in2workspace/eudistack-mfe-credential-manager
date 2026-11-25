import { HttpErrorResponse } from '@angular/common/http';
import { toRevocationFailure } from './revocation-error';

const problem = (type: unknown, status = 400) => new HttpErrorResponse({ status, error: { type } });

describe('toRevocationFailure', () => {
  it('flags already_revoked so the detail is read again, and gives it the already revoked message', () => {
    const failure = toRevocationFailure(problem('already_revoked', 409));

    expect(failure).toEqual({
      messageKey: 'credentialDetails.revokeCredentialSuccess.alreadyRevoked',
      alreadyRevoked: true,
    });
  });

  it.each([
    ['not_revocable', 409, 'notRevocable'],
    ['insufficient_permission', 403, 'forbidden'],
    ['issuance_not_found', 404, 'forbidden'],
    ['tenant_mismatch', 403, 'forbidden'],
    ['tenant_not_resolved', 403, 'forbidden'],
    ['invalid_token', 401, 'sessionExpired'],
    ['authentication_error', 401, 'sessionExpired'],
    ['BAD_REQUEST', 400, 'badRequest'],
    ['rate_limited', 429, 'retryLater'],
    ['status_list_unavailable', 503, 'retryLater'],
  ])('maps %s (%s) to %s', (type: string, status: number, key: string) => {
    expect(toRevocationFailure(problem(type, status))).toEqual({
      messageKey: `credentialDetails.revokeError.${key}`,
      alreadyRevoked: false,
    });
  });

  it('tells the two 409 apart by their type, not by the status', () => {
    const alreadyRevoked = toRevocationFailure(problem('already_revoked', 409));
    const notRevocable = toRevocationFailure(problem('not_revocable', 409));

    expect(alreadyRevoked.messageKey).not.toBe(notRevocable.messageKey);
    expect(alreadyRevoked.alreadyRevoked).toBe(true);
    expect(notRevocable.alreadyRevoked).toBe(false);
  });

  const generic = { messageKey: 'credentialDetails.revokeError.generic', alreadyRevoked: false };

  it.each([
    ['an unknown type', problem('something_new', 500)],
    ['INTERNAL_SERVER_ERROR', problem('INTERNAL_SERVER_ERROR', 500)],
    ['a type that is not a string', problem(42, 500)],
    ['a null type', problem(null, 500)],
    ['a body without a type', new HttpErrorResponse({ status: 500, error: {} })],
    ['a null body', new HttpErrorResponse({ status: 500, error: null })],
    ['a text body', new HttpErrorResponse({ status: 502, error: 'Bad Gateway' })],
    ['a network failure', new HttpErrorResponse({ status: 0 })],
  ])('gives the generic message for %s', (_label: string, error: HttpErrorResponse) => {
    expect(toRevocationFailure(error)).toEqual(generic);
  });

  it('does not fall back to the HTTP status when the type is missing', () => {
    expect(toRevocationFailure(new HttpErrorResponse({ status: 401, error: {} }))).toEqual(generic);
    expect(toRevocationFailure(new HttpErrorResponse({ status: 409, error: {} }))).toEqual(generic);
  });

  it.each([
    ['an Error', new Error('boom')],
    ['undefined', undefined],
    ['null', null],
    ['a string', 'already_revoked'],
  ])('gives the generic message when the error is %s', (_label: string, error: unknown) => {
    expect(toRevocationFailure(error)).toEqual(generic);
  });
});
