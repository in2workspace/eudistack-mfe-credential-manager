import { Injectable, signal } from '@angular/core';
import { HolderPublicJwk } from '../models/entity/lear-credential-issuance';

/**
 * Carries the public half of the holder key from the key-generator widget to the issuance request
 * (EUD-168 AD-8).
 *
 * The two need to meet and cannot inject each other. `KeyGeneratorService` is deliberately scoped to
 * `KeyGeneratorComponent` — «not provided in root but in key generator component» — so its state
 * dies with the form, which is the right lifecycle for a private key. And `KeyGeneratorComponent`
 * cannot reach for `CredentialIssuanceService`, because the machine issuance schema already imports
 * the component and that would close an import cycle.
 *
 * Hence this: root-provided, deliberately tiny, holding only the half that is safe to move around.
 * The private key never passes through here.
 */
@Injectable({ providedIn: 'root' })
export class HolderKeyStoreService {

  private readonly publicJwk = signal<HolderPublicJwk | undefined>(undefined);

  public set(publicJwk: HolderPublicJwk): void {
    this.publicJwk.set(publicJwk);
  }

  /**
   * Reads the stored key and clears it in the same step.
   *
   * Clearing on read is what stops a key generated for one issuance from being attached to the next
   * one: the store outlives the form, so a value left behind would silently bind a later credential
   * to a key that belongs to an earlier one — a mistake nothing downstream would ever reveal.
   */
  public take(): HolderPublicJwk | undefined {
    const current = this.publicJwk();
    this.publicJwk.set(undefined);
    return current;
  }

  public clear(): void {
    this.publicJwk.set(undefined);
  }
}
