import { Injectable, signal } from '@angular/core';

/**
 * The private half of a holder key, sealed to the submission it was generated for (EUD-233 AD-6):
 * `credentialConfigurationId` and `submissionId` let the consumer verify this key belongs to the
 * emission it is about to re-present, rather than to an earlier, abandoned attempt.
 */
export interface HolderPrivateKeyEntry {
  privateKeyHex: string;
  credentialConfigurationId: string;
  submissionId: string;
}

/**
 * Root, memory-only handoff of the private key from `KeyGeneratorComponent` to
 * `DirectCredentialResultDialogComponent` (EUD-233 AD-6).
 *
 * `HolderKeyStoreService` carries the public half and is documented to "never see the private" --
 * a tested security property from EUD-168 (AD-12). Adding a private slot there would invert that
 * property, so this is a sibling store instead, never an extension of it.
 *
 * Deliberately dumb: it holds one sealed entry and hands it back destructively, but it does not
 * decide whether the seal is valid for whoever is asking. That comparison -- does this entry's
 * `credentialConfigurationId`/`submissionId` match the submission in hand? -- belongs to the
 * consumer (`CredentialIssuanceService`), the only place that knows what "the current submission" is.
 *
 * Never logs `privateKeyHex`, at any level, anywhere in this class (R-7).
 */
@Injectable({ providedIn: 'root' })
export class HolderPrivateKeyStore {

  private readonly entry = signal<HolderPrivateKeyEntry | undefined>(undefined);

  public set(entry: HolderPrivateKeyEntry): void {
    this.entry.set(entry);
  }

  /**
   * Destructive read, no parameters: hands back whatever sealed entry is present (or `undefined`)
   * and clears the slot unconditionally, whether or not the caller goes on to accept it. Unlike
   * `HolderKeyStoreService.peek()`, there is no non-destructive variant -- the public half is
   * retried across HTTP failures, the private half is consumed exactly once, on confirmed direct
   * delivery.
   */
  public take(): HolderPrivateKeyEntry | undefined {
    const current = this.entry();
    this.entry.set(undefined);
    return current;
  }

  public clear(): void {
    this.entry.set(undefined);
  }
}
