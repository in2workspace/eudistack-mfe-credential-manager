import { HttpErrorResponse } from '@angular/common/http';

export interface RevocationFailure {
  /** i18n key of the message for the operator. */
  messageKey: string;
  /** The attestation was already revoked: the detail has to be read again and shown as Revoked. */
  alreadyRevoked: boolean;
}

const ERROR_KEY_PREFIX = 'credentialDetails.revokeError.';

const failure = (key: string): RevocationFailure => ({ messageKey: ERROR_KEY_PREFIX + key, alreadyRevoked: false });

const ALREADY_REVOKED: RevocationFailure = {
  messageKey: 'credentialDetails.revokeCredentialSuccess.alreadyRevoked',
  alreadyRevoked: true,
};

/**
 * The message for an error of the revocation API: its RFC 9457 `type` decides (EUD-248 PRD §5), never the
 * HTTP status, because the 409 groups `already_revoked` and `not_revocable`. A `type` the table does not
 * know, or an answer without one, gets the generic message.
 */
export function toRevocationFailure(error: unknown): RevocationFailure {
  const type: unknown = error instanceof HttpErrorResponse ? error.error?.type : undefined;
  switch (type) {
    case 'already_revoked':
      return ALREADY_REVOKED;
    case 'not_revocable':
      return failure('notRevocable');
    case 'insufficient_permission':
    case 'issuance_not_found':
    case 'tenant_mismatch':
    case 'tenant_not_resolved':
      return failure('forbidden');
    case 'invalid_token':
    case 'authentication_error':
      return failure('sessionExpired');
    case 'BAD_REQUEST':
      return failure('badRequest');
    case 'rate_limited':
    case 'status_list_unavailable':
      return failure('retryLater');
    default:
      return failure('generic');
  }
}
