import { Injectable, inject } from '@angular/core';
import { KeyGeneratorService } from './key-generator.service';
import { HolderPrivateKeyStore } from 'src/app/core/services/holder-private-key-store.service';
import { HolderKeyStoreService } from 'src/app/core/services/holder-key-store.service';
import { HolderBinding } from 'src/app/core/models/entity/holder-binding';
import { HolderKeyGenerationError } from 'src/app/core/models/entity/holder-key-generation-error';

/**
 * Invisible key provisioning for one submission attempt (AC-12.1, AD-6).
 *
 * The only call site of `KeyGeneratorService.generateP256()`: harvests the three products of the
 * pair it produces and routes each to its own destination (AD-6's "un paso, tres consumidores") --
 * `did:key` travels back to the caller as part of a `HolderBinding` for `mandatee.id`, the public
 * JWK is written to `HolderKeyStoreService` (unchanged mechanism from EUD-168, only its writer
 * changes) for `holder_key.jwk`, and the private half is sealed into `HolderPrivateKeyStore` under
 * (`credentialConfigurationId`, `submissionId`). Clears `KeyGeneratorService`'s own state in the
 * same tick regardless of outcome (hardens `NFR-S-EUD168-04(a)`, AD-6 cleanup point 5), and on
 * failure leaves a diagnostic trace for engineering only, before throwing a typed error the generic
 * submission error path does not need to inspect (ES-09, AD-15).
 *
 * Component-scoped (`CredentialIssuanceComponent`'s `providers`), never `root` -- same injector as
 * `KeyGeneratorService`, whose private key material must not outlive the form (AD-6).
 */
@Injectable()
export class IssuanceHolderKeyService {

  private readonly keyGenerator = inject(KeyGeneratorService);
  private readonly privateKeyStore = inject(HolderPrivateKeyStore);
  private readonly holderKeyStore = inject(HolderKeyStoreService);

  public async generateForSubmission(
    credentialConfigurationId: string,
    submissionId: string
  ): Promise<HolderBinding> {
    try {
      await this.keyGenerator.generateP256();

      const state = this.keyGenerator.getState()();
      if (!state?.desmosPublicJwk) {
        throw new Error('KeyGeneratorService produced no public JWK');
      }

      const binding: HolderBinding = {
        didKey: state.desmosDidKeyValue,
        publicJwk: state.desmosPublicJwk,
      };
      this.privateKeyStore.set({
        privateKeyHex: state.desmosPrivateKeyValue,
        credentialConfigurationId,
        submissionId,
      });
      // Sealed the same way as the private half (2026-09-17 hardening) -- attachHolderKey() must
      // verify this entry belongs to the exact attempt asking for it, not just peek whatever is
      // currently in the shared root store.
      this.holderKeyStore.set({ publicJwk: binding.publicJwk, credentialConfigurationId, submissionId });
      return binding;
    } catch (cause) {
      // AD-15: exactly these four closed fields, never the key material, the form, or the stack.
      console.error({
        event: 'holder_key_generation_failed',
        credentialConfigurationId,
        submissionId,
        cause: cause instanceof Error ? cause.name : 'UnknownError',
      });
      throw new HolderKeyGenerationError('Holder key generation failed', { cause });
    } finally {
      this.keyGenerator.clearState();
    }
  }

  /**
   * Defense-in-depth teardown of every half of the pair this service can write: `KeyGeneratorService`'s
   * own state (already cleared in the same tick by `generateForSubmission`, idempotent here), the
   * sealed private-key handoff, and the public-JWK store. The single entry point
   * `CredentialIssuanceService` calls from its `DestroyRef` hook (AD-6 cleanup point 6) -- the
   * transport-failure, declared-and-failed, and surface-close cleanup points (1-4) act on
   * `HolderPrivateKeyStore` (and, where relevant, `HolderKeyStoreService`) directly instead, per the
   * Story's sequence diagram.
   */
  public clear(): void {
    this.keyGenerator.clearState();
    this.privateKeyStore.clear();
    this.holderKeyStore.clear();
  }
}
