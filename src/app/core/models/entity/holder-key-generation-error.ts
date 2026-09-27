/**
 * Thrown by `IssuanceHolderKeyService.generateForSubmission()` when key generation fails (ES-09).
 *
 * A stable, typed name lets the generic `catchError` in `CredentialIssuanceService` route this
 * exactly like any other submission failure (ES-04) without inspecting the cause: distinguishability
 * lives in the type and in the `console.error` trace already emitted before this is thrown (AD-15),
 * never in how the Operator-facing error path branches.
 */
export class HolderKeyGenerationError extends Error {
  public override readonly name = 'HolderKeyGenerationError';

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}
