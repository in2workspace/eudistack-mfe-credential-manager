import { Injectable, signal } from '@angular/core';
import { HolderPublicJwk } from '../models/entity/lear-credential-issuance';

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
 */
@Injectable({ providedIn: 'root' })
export class HolderKeyStoreService {

  private readonly publicJwk = signal<HolderPublicJwk | undefined>(undefined);

  public set(publicJwk: HolderPublicJwk): void {
    this.publicJwk.set(publicJwk);
  }

  /**
   * Reads the stored key without consuming it. Non-destructive by convention, not because a retry
   * needs to find the same key twice: since AD-6, each submission attempt calls
   * `generateForSubmission()` again, which overwrites this store with a freshly generated pair
   * before `attachHolderKey()` ever peeks it -- there is no "same key survives a retry" case left
   * to preserve. `clear()` is still called once real success is confirmed, or when a type that
   * does not require a holder key is submitted, to avoid leaking a stale entry across types.
   */
  public peek(): HolderPublicJwk | undefined {
    return this.publicJwk();
  }

  public clear(): void {
    this.publicJwk.set(undefined);
  }
}
