import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { CopyableFieldComponent } from '../copyable-field/copyable-field.component';
import { HolderPrivateKeySectionComponent } from '../holder-private-key-section/holder-private-key-section.component';
import { CredentialOfferQrComponent } from '../credential-offer-qr/credential-offer-qr.component';
import { DeliveryOutcomeListComponent } from '../delivery-outcome-list/delivery-outcome-list.component';
import { UncopiedArtifactCloseGuard, ArtifactKind } from 'src/app/shared/services/uncopied-artifact-close-guard';
import { DeliveryModeToken } from 'src/app/core/models/entity/lear-credential-issuance';
import { ChannelOutcome } from 'src/app/core/models/entity/issuance-channel-outcome';

export interface DirectCredentialResultDialogData {
  signedCredential: string;
  /** `requiresRequestHolderKey(configId)` at the host -- AC-01 (false) vs AC-07/AC-10.1 (true). */
  requiresHolderKeySection: boolean;
  /** Present only when `requiresHolderKeySection` and the store still had it (AC-07); absent under `requiresHolderKeySection` is AC-10.1. */
  privateKeyHex?: string;
  outcomes: ReadonlyMap<DeliveryModeToken, ChannelOutcome>;
  /** Present only when the `ui` channel delivered (EC-02) -- embeds the QR alongside the credential. */
  credentialOfferUri?: string;
}

/**
 * The direct-delivery success surface (EUD-233 AD-6/AD-7/AD-8/AD-10/AD-14/AD-16): one or two
 * copyable artifacts -- the signed credential always, the holder's private key only for the two
 * AD-8 exempt machine types -- plus the per-channel result when the emission was hybrid.
 *
 * **Opener contract.** Must be opened with `disableClose: true` and `closeOnNavigation: false` in
 * the `MatDialogConfig` (Task 25): the first because `UncopiedArtifactCloseGuard` takes over
 * backdrop/Esc interception itself and needs Material not to race it; the second because Material
 * otherwise closes the dialog on `NavigationStart`, before the guard's own `popstate` listener ever
 * gets a chance to react to the browser's back button (R-15).
 */
@Component({
  selector: 'app-direct-credential-result-dialog',
  imports: [
    MatButton,
    MatIconButton,
    MatIcon,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    TranslatePipe,
    CopyableFieldComponent,
    HolderPrivateKeySectionComponent,
    CredentialOfferQrComponent,
    DeliveryOutcomeListComponent,
  ],
  templateUrl: './direct-credential-result-dialog.component.html',
  styleUrl: './direct-credential-result-dialog.component.scss'
})
export class DirectCredentialResultDialogComponent {
  public readonly data = inject<DirectCredentialResultDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<DirectCredentialResultDialogComponent>);
  private readonly closeGuard = inject(UncopiedArtifactCloseGuard);

  protected readonly credentialCopied = signal(false);
  protected readonly credentialCopyFailed = signal(false);
  protected readonly privateKeyCopied = signal(false);
  protected readonly privateKeyCopyFailed = signal(false);

  /** Whether the key section renders at all -- distinct from whether it *has* a key (AC-10.1). */
  protected readonly hasKeySection = this.data.requiresHolderKeySection;
  /**
   * Whether there is a key artifact for `pendingArtifacts`/Done to gate on. Truthiness, not
   * `!== undefined`: matches `HolderPrivateKeySectionComponent`'s own `@if (privateKeyHex(); ...)`
   * render check, so the two can never disagree about an empty-string edge case.
   */
  private readonly hasKeyArtifact = this.data.requiresHolderKeySection && !!this.data.privateKeyHex;
  /** More than one requested channel: only then is the per-channel breakdown shown (AC-04/EC-07). */
  protected readonly showOutcomes = this.data.outcomes.size > 1;

  /**
   * Clipboard-clear TTL for the signed credential (F4, 2026-09-17 hardening) -- same duration and
   * mechanism as the private key's (`HolderPrivateKeySectionComponent`), closing the asymmetry:
   * the VC carries mandator PII and had no auto-clear at all before this.
   */
  private static readonly CREDENTIAL_CLIPBOARD_TTL_MS = 60_000;
  protected readonly credentialClipboardTtlMs = DirectCredentialResultDialogComponent.CREDENTIAL_CLIPBOARD_TTL_MS;

  /**
   * AD-16: the single source both `Done`'s gating and the close guard read. The credential is
   * always in scope; the private key only when there is one to protect (AC-10.1 falls out of this
   * naturally -- an artifact this surface never had never enters the list, so it never blocks
   * `Done` and never triggers the guard).
   */
  protected readonly pendingArtifacts = computed<readonly ArtifactKind[]>(() => {
    const pending: ArtifactKind[] = [];
    if (!this.credentialCopied()) {
      pending.push('credential');
    }
    if (this.hasKeyArtifact && !this.privateKeyCopied()) {
      pending.push('privateKey');
    }
    return pending;
  });

  /**
   * The top instructional line -- names which artifacts THIS surface holds, not which are still
   * uncopied. Deliberately static: derived from `hasKeyArtifact` (fixed at open time), never from
   * `pendingArtifacts`, so copying the credential first does not make the warning drop it and
   * start talking only about the key (that would be misleading -- both were still shown, both
   * still need to have been taken). The credential itself is always present in this dialog's data
   * (`signedCredential` is non-optional), so the only two reachable cases here are
   * credential-only and credential+key.
   */
  protected readonly copyInstructionKey = computed<string>(() => {
    if (this.hasKeyArtifact) {
      return 'credentialIssuance.direct-result-dialog.messageCredentialAndKey';
    }
    return 'credentialIssuance.direct-result-dialog.message';
  });

  // closeOnNavigationDisabled: true -- this dialog is always opened with closeOnNavigation: false
  // (opener contract, see class doc above).
  private readonly guardHandle = this.closeGuard.protect(this.dialogRef, this.pendingArtifacts, { closeOnNavigationDisabled: true });

  protected onCredentialCopied(): void {
    this.credentialCopied.set(true);
    this.credentialCopyFailed.set(false);
  }

  protected onPrivateKeyCopied(): void {
    this.privateKeyCopied.set(true);
    this.privateKeyCopyFailed.set(false);
  }

  /** The secondary "Close" / X control (EC-04) -- goes through the guard, never `dialogRef.close()` directly. */
  protected requestClose(): void {
    this.guardHandle.requestClose();
  }

  /** "Done" -- the primary action, ungated by the guard by construction: only enabled once nothing is pending. */
  protected done(): void {
    this.dialogRef.close();
  }
}
