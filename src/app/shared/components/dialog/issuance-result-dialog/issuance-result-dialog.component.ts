import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { DeliveryMode, DELIVERY_RESULT_ORDER } from 'src/app/core/models/entity/lear-credential-issuance';
import { CopyableFieldComponent } from '../copyable-field/copyable-field.component';
import { CredentialOfferQrComponent } from '../credential-offer-qr/credential-offer-qr.component';

export interface IssuanceResultDialogData {
  /** Modes the Operator selected. Drives which boxes appear; order comes from DELIVERY_RESULT_ORDER. */
  deliveryModes: readonly DeliveryMode[];
  /**
   * The signed credential, for the `direct` box. Optional on purpose: if the backend answered
   * without it, the dialog still has to open, because closing it destroys the only copy of the
   * private key.
   */
  credentialToken?: string;
  /**
   * Private half of the holder key, when one was generated. Absent for credential types that do
   * not bind to a holder key, and the field is then not rendered at all.
   */
  privateKey?: string;
  /** Offer URI for the `ui` box. */
  credentialOfferUri?: string;
}

/**
 * Result of a successful issuance, one box per delivery mode the Operator chose.
 *
 * Single-mode `email` and single-mode `ui` do NOT come here — they keep their existing dialogs
 * untouched. This handles every combination, and every selection containing `direct`.
 *
 * Boxes are ordered by how urgently the Operator has to act on them (`DELIVERY_RESULT_ORDER`):
 * `direct` hands over a credential and a key that exist nowhere else, `ui` a QR to scan now,
 * `email` only an acknowledgement.
 */
@Component({
  selector: 'app-issuance-result-dialog',
  imports: [
    MatButton,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    CopyableFieldComponent,
    CredentialOfferQrComponent,
    TranslatePipe,
  ],
  templateUrl: './issuance-result-dialog.component.html',
  styleUrl: './issuance-result-dialog.component.scss'
})
export class IssuanceResultDialogComponent {
  public readonly data = inject<IssuanceResultDialogData>(MAT_DIALOG_DATA);

  /** Selected modes in render order, ignoring anything unrecognised. */
  public readonly orderedModes: DeliveryMode[] =
    DELIVERY_RESULT_ORDER.filter(mode => this.data.deliveryModes?.includes(mode));

  /**
   * Both wallet channels serve the SAME credential offer, and it can only be redeemed once, so
   * whichever the holder uses first wins and the other stops working. Worth saying out loud
   * rather than leaving them to discover it.
   */
  public readonly showBothWalletChannelsNote: boolean =
    this.orderedModes.includes('ui') && this.orderedModes.includes('email');

  private readonly dialogRef = inject(MatDialogRef<IssuanceResultDialogComponent>);

  public close(): void {
    this.dialogRef.close();
  }
}
