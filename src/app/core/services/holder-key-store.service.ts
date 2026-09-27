import { Injectable, signal } from '@angular/core';
import { HolderPublicJwk } from '../models/entity/lear-credential-issuance';

/**
 * The public half of a holder key, sealed to the submission it was generated for (EUD-233 AD-6,
 * hardened post-review 2026-09-17 to close the asymmetry with `HolderPrivateKeyStore`, which was
 * sealed from the start): `credentialConfigurationId` and `submissionId` let the consumer verify
 * this entry belongs to the emission it is about to bind, not to an earlier or concurrent attempt.
 */
export interface HolderPublicKeyEntry {
  publicJwk: HolderPublicJwk;
  credentialConfigurationId: string;
  submissionId: string;
}

/**
 * Carries the public half of the holder key from its generation to the issuance request
 * (EUD-168 AD-8).
 *
 * Written by `IssuanceHolderKeyService.generateForSubmission()` (EUD-233 AD-6) -- once per
 * submission attempt, invisibly, inside the submit command -- and read by
 * `CredentialIssuanceService.attachHolderKey()` moments later, in the same attempt. The two are
 * component-scoped siblings (`CredentialIssuanceComponent`'s `providers`) and could inject each
 * other directly, but this root-provided, deliberately tiny store is kept as the seam between them
 * regardless: it is also what `CredentialIssuanceService.credentialRequestFactory`'s callers read
 * without needing a reference to the key-generation service itself.
 *
 * Root-provided, holding only the half that is safe to move around. The private key never passes
 * through here -- see `HolderPrivateKeyStore` for that, which is sealed and read destructively.
 *
 * Deliberately dumb, mirroring `HolderPrivateKeyStore`: it hands back whatever sealed entry is
 * present, but does not decide whether the seal matches the caller's current attempt -- that
 * comparison belongs to the consumer (`CredentialIssuanceService.attachHolderKey()`), the only
 * place that knows what "the current submission" is.
 */
@Injectable({ providedIn: 'root' })
export class HolderKeyStoreService {

  private readonly entry = signal<HolderPublicKeyEntry | undefined>(undefined);

  public set(entry: HolderPublicKeyEntry): void {
    this.entry.set(entry);
  }

  /**
   * Reads the stored entry without consuming it. Non-destructive by convention, not because a
   * retry needs to find the same key twice: since AD-6, each submission attempt calls
   * `generateForSubmission()` again, which overwrites this store with a freshly generated (and
   * freshly sealed) pair before `attachHolderKey()` ever peeks it -- there is no "same key
   * survives a retry" case left to preserve. `clear()` is still called once real success is
   * confirmed, or when a type that does not require a holder key is submitted, to avoid leaking a
   * stale entry across types.
   */
  public peek(): HolderPublicKeyEntry | undefined {
    return this.entry();
  }

  public clear(): void {
    this.entry.set(undefined);
  }
}
