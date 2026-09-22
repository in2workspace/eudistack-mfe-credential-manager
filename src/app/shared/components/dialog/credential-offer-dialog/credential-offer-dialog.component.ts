import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { HolderPrivateKeySectionComponent } from '../holder-private-key-section/holder-private-key-section.component';
import { DeliveryOutcomeListComponent } from '../delivery-outcome-list/delivery-outcome-list.component';
import { ArtifactKind, UncopiedArtifactCloseGuard, UncopiedArtifactCloseGuardHandle } from 'src/app/shared/services/uncopied-artifact-close-guard';
import { DeliveryModeToken } from 'src/app/core/models/entity/lear-credential-issuance';
import { ChannelOutcome } from 'src/app/core/models/entity/issuance-channel-outcome';

export interface CredentialOfferDialogData {
  /** Absent means email-only: no QR to show, the per-channel outcome box carries the acknowledgement instead. */
  credentialOfferUri?: string;
  /** Host's `requiresRequestHolderKey(configId)` -- true only for the two EUD-233  AD-8 exempt machine types. */
  requiresHolderKeySection?: boolean;
  /** Present only when `requiresHolderKeySection` and the store still had it (EUD-233 AC-13); absent under `requiresHolderKeySection` is AC-10.2. */
  privateKeyHex?: string;
  outcomes: ReadonlyMap<DeliveryModeToken, ChannelOutcome>;
}

/**
 * The solo-Wallet post-emission surface (EUD-233 AD-8): extended in place, never replaced. What is
 * added on top of the AS-IS content is conditional on `requiresHolderKeySection` alone; for the
 * regression path (any type outside AD-8's two exceptions) `disableClose` and event wiring stay
 * byte-for-byte what they were before this Story (AC-05.2). The per-channel outcome, however,
 * always renders through `DeliveryOutcomeListComponent` now (single channel or hybrid alike), the
 * same bordered/titled box `DirectCredentialResultDialogComponent` uses -- selecting a single
 * delivery method (`ui` or `email` alone) must not fall back to the old borderless/untitled
 * presentation just because it is the only one requested.
 */
@Component({
    selector: 'app-credential-offer-dialog',
    imports: [
        MatButton,
        MatIconButton,
        MatIcon,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        TranslatePipe,
        HolderPrivateKeySectionComponent,
        DeliveryOutcomeListComponent,
    ],
    templateUrl: './credential-offer-dialog.component.html',
    styleUrl: './credential-offer-dialog.component.scss'
})
export class CredentialOfferDialogComponent {
  public readonly data = inject<CredentialOfferDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CredentialOfferDialogComponent>);
  private readonly closeGuard = inject(UncopiedArtifactCloseGuard);

  /** Structural: whether this surface has a key section at all, not whether a key is present now. */
  protected readonly hasKeySection = !!this.data.requiresHolderKeySection;
  // Truthiness, not `!== undefined`: matches HolderPrivateKeySectionComponent's own
  // `@if (privateKeyHex(); ...)` render check, so the two can never disagree about an
  // empty-string edge case.
  private readonly hasKeyArtifact = this.hasKeySection && !!this.data.privateKeyHex;

  protected readonly privateKeyCopied = signal(false);
  protected readonly privateKeyCopyFailed = signal(false);

  protected readonly titleKey = this.data.credentialOfferUri
    ? 'credentialIssuance.credential-offer-dialog.title'
    : 'credentialIssuance.create-success-dialog.title';

  /** AC-13: this surface's only trackable artifact is the key -- there is no credential block here. */
  protected readonly pendingArtifacts = computed<readonly ArtifactKind[]>(() =>
    this.hasKeyArtifact && !this.privateKeyCopied() ? ['privateKey'] : []
  );

  /**
   * Wired only when `hasKeySection`: with no key section this surface never has anything to
   * protect, so leaving the guard out entirely -- not just letting `pendingArtifacts` settle to
   * empty -- is what keeps the regression path's `disableClose`/backdrop/Esc behavior identical to
   * before this Story ("conserva su Close único AS-IS").
   */
  // closeOnNavigationDisabled: true -- this branch only runs when hasKeySection is true, which is
  // exactly when the host opens this dialog with closeOnNavigation: false (the two flags share
  // the same requiresHolderKeySection source, see openCredentialOfferDialog()).
  private readonly guardHandle: UncopiedArtifactCloseGuardHandle | undefined = this.hasKeySection
    ? this.closeGuard.protect(this.dialogRef, this.pendingArtifacts, { closeOnNavigationDisabled: true })
    : undefined;

  protected onPrivateKeyCopied(): void {
    this.privateKeyCopied.set(true);
    this.privateKeyCopyFailed.set(false);
  }

  /** The header "X" -- only rendered when `hasKeySection`, where `guardHandle` is always set. */
  protected requestClose(): void {
    this.guardHandle?.requestClose();
  }

  /** "Done" (gated, key section present) or "Close" (AS-IS, ungated) -- both close the same way. */
  public close(): void {
    this.dialogRef.close();
  }
}
