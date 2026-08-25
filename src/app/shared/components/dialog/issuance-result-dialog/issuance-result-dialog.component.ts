import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { DeliveryMode, DELIVERY_RESULT_ORDER } from 'src/app/core/models/entity/lear-credential-issuance';
import { IssuanceDeliveryResultDto } from 'src/app/core/models/dto/lear-credential-issuance-request.dto';
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
   * not bind to a holder key, and no key is then rendered at all.
   *
   * Where it renders depends on whether there is a credential to pair it with — see
   * `keyInsideDirectBox`. The key belongs to the credential, not to a delivery channel: a type
   * with no cryptographic binding method binds to it whichever way the credential travelled, so
   * the Operator has to keep it after a QR or an email just as much as after a direct issuance.
   */
  privateKey?: string;
  /** Offer URI for the `ui` box. */
  credentialOfferUri?: string;
  /**
   * Per-mode outcome as reported by the backend (`delivery_results`), on success and on failure
   * alike. Absent for an older backend or for a failure that never ran a delivery mode, in which
   * case every box falls back to its pre-existing rendering.
   */
  deliveryResults?: readonly IssuanceDeliveryResultDto[];
  /**
   * The issuance as a whole failed (the request answered 5xx). The dialog still opens: a generated
   * holder key exists nowhere else, and the wallet leg may have dispatched a credential bound to it.
   */
  failed?: boolean;
}

/**
 * Result of a successful issuance: one box per delivery mode the Operator chose, plus the holder
 * key wherever it belongs.
 *
 * Single-mode `email` and single-mode `ui` come here only when there is a key to hand over —
 * otherwise they keep their existing dialogs untouched. This handles every combination, and
 * every selection containing `direct`.
 *
 * Boxes are ordered by how urgently the Operator has to act on them (`DELIVERY_RESULT_ORDER`):
 * `direct` hands over a credential, `ui` a QR to scan now, `email` only an acknowledgement. A
 * key with no direct box to live in comes first, because it is then the only thing in the dialog
 * that exists nowhere else and cannot be recovered after closing.
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
   * Per-mode outcome, indexed for the template.
   *
   * Declared before the flags below because TypeScript initialises class fields in order and they
   * read it through {@link hasFailed}.
   */
  private readonly resultByMode: ReadonlyMap<string, IssuanceDeliveryResultDto> =
    new Map((this.data.deliveryResults ?? []).map(result => [result.mode, result]));

  public readonly failed: boolean = this.data.failed === true;

  /** Whether any declared mode came back failed — drives the summary banner. */
  public readonly hasAnyFailure: boolean =
    this.orderedModes.some(mode => this.hasFailed(mode));

  /**
   * The key renders INSIDE the `direct` box when that box exists AND direct actually delivered:
   * there the credential and the key are the two halves of a single hand-over, and splitting them
   * across boxes would ask the Operator to copy two things that only work together from two
   * different places. With no credential to pair it with, the key gets its own box instead.
   */
  public readonly keyInsideDirectBox: boolean =
    !!this.data.privateKey && this.orderedModes.includes('direct') && !this.hasFailed('direct');

  /**
   * With no direct box to live in — a wallet-only issuance of a type that still binds to a key —
   * the key gets a box of its own, first, since nothing else in the dialog is unrecoverable.
   */
  public readonly keyInOwnBox: boolean = !!this.data.privateKey && !this.keyInsideDirectBox;

  /**
   * Both wallet channels serve the SAME credential offer, and it can only be redeemed once, so
   * whichever the holder uses first wins and the other stops working. Worth saying out loud
   * rather than leaving them to discover it.
   *
   * Suppressed when either channel failed: there is then no race to warn about, and the note would
   * contradict the failure right above it.
   */
  public readonly showBothWalletChannelsNote: boolean =
    this.orderedModes.includes('ui') && this.orderedModes.includes('email')
    && !this.hasFailed('ui') && !this.hasFailed('email');

  /**
   * Whether this mode is reported as failed.
   *
   * Absent results mean the backend said nothing about the mode, which is NOT a failure: an older
   * backend, or a failure that never reached the delivery stage. Boxes then keep their previous
   * rendering rather than inventing a verdict.
   */
  public hasFailed(mode: DeliveryMode): boolean {
    return this.resultByMode.get(mode)?.status === 'failed';
  }

  /** Backend-supplied detail for a failed mode, shown verbatim under the box title. */
  public errorOf(mode: DeliveryMode): string | undefined {
    return this.resultByMode.get(mode)?.error;
  }

  /** The `direct` box announces the key only when the key actually renders inside it. */
  public sectionTitleKey(mode: DeliveryMode): string {
    const suffix = mode === 'direct' && this.keyInsideDirectBox ? 'directWithKey' : mode;
    return `credentialIssuance.issuance-result-dialog.section.${suffix}`;
  }

  private readonly dialogRef = inject(MatDialogRef<IssuanceResultDialogComponent>);

  public close(): void {
    this.dialogRef.close();
  }
}
