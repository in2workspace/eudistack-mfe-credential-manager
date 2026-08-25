import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { DeliveryMode, DELIVERY_RESULT_ORDER } from 'src/app/core/models/entity/lear-credential-issuance';
import { IssuanceDeliveryResultDto } from 'src/app/core/models/dto/lear-credential-issuance-request.dto';
import { CopyableFieldComponent } from '../copyable-field/copyable-field.component';
import { CredentialOfferQrComponent } from '../credential-offer-qr/credential-offer-qr.component';

const DIALOG = 'credentialIssuance.issuance-result-dialog.';
const HANDOVER_TITLE = `${DIALOG}handover.`;

/**
 * What the dialog knows about a declared delivery mode.
 *
 * `unconfirmed` is a third answer on purpose. The issuance failed as a whole and the error body
 * said nothing about this mode, so claiming either outcome would be an invention — and the success
 * branch inventing one is what used to make a box announce an email that may never have gone out.
 */
export type ModeOutcome = 'ok' | 'failed' | 'unconfirmed';

export interface IssuanceResultDialogData {
  /** Modes the Operator selected. Drives which boxes appear; order comes from DELIVERY_RESULT_ORDER. */
  deliveryModes: readonly DeliveryMode[];
  /**
   * The signed credential, for the hand-over box. Optional on purpose: if the backend answered
   * without it, the dialog still has to open, because closing it destroys the only copy of the
   * private key.
   */
  credentialToken?: string;
  /**
   * Private half of the holder key, when one was generated. Absent for credential types that do
   * not bind to a holder key, and no key is then rendered at all.
   *
   * Goes in the hand-over box, with the credential when there is one. The key belongs to the
   * credential, not to a delivery channel: a type with no cryptographic binding method binds to it
   * whichever way the credential travelled, so the Operator has to keep it after a QR or an email
   * just as much as after a direct issuance.
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
 * Result of an issuance: a hand-over box carrying whatever exists nowhere else, then one status
 * box per remaining channel.
 *
 * Split by what the Operator has to DO, not by delivery mode. The credential token and the holder
 * key are hand-overs — shown once, destroyed by closing the dialog — so they share a single box
 * and a single warning, whichever of them is present. `ui` and `email` are notifications about a
 * credential travelling elsewhere, and so is a `direct` delivery that failed; those get a box
 * each, in `DELIVERY_RESULT_ORDER`.
 *
 * Single-mode `email` and single-mode `ui` come here only when there is a key to hand over —
 * otherwise they keep their existing dialogs untouched.
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

  /**
   * Nothing is confirmed as working, and at least one channel's outcome is unknown.
   *
   * The distinction that matters for the holder key: "every channel failed" means the credential is
   * nowhere and the key unlocks nothing, while "we could not find out" leaves a dispatch that may
   * well have happened, bound to a key this dialog holds the only copy of.
   */
  public readonly deliveryUnconfirmed: boolean =
    !this.orderedModes.some(mode => this.canDeliver(mode))
    && this.orderedModes.some(mode => this.outcomeOf(mode) === 'unconfirmed');

  /** Whether any declared mode came back failed — drives the summary banner. */
  public readonly hasAnyFailure: boolean =
    this.orderedModes.some(mode => this.hasFailed(mode));

  /**
   * Whether the credential itself is handed over here. Only `direct` returns it in the issuance
   * response, and only when its outcome is known to be good.
   */
  public readonly showsToken: boolean =
    this.orderedModes.includes('direct') && this.outcomeOf('direct') === 'ok';

  /**
   * Whether the holder key is worth handing over, i.e. whether the Operator can actually end up
   * with the credential it binds.
   *
   * A key is only ever useful next to a channel that worked: the credential the holder redeems is
   * bound to it, and without it that credential cannot be presented. With every declared channel
   * failed there is nothing to redeem and nothing to pair the key with — showing it would ask the
   * Operator to keep a secret that unlocks nothing, since re-issuing generates a new one.
   *
   * The exception is {@link deliveryUnconfirmed}: not knowing is not the same as knowing it failed,
   * and a key withheld from a delivery that did go out is unrecoverable.
   */
  public readonly showsKey: boolean = !!this.data.privateKey
    && (this.orderedModes.some(mode => this.canDeliver(mode)) || this.deliveryUnconfirmed);

  /**
   * Title of the hand-over box, naming whatever ended up inside it, or {@code null} when there is
   * nothing to hand over and the box does not render at all.
   */
  public readonly handoverTitleKey: string | null =
    IssuanceResultDialogComponent.handoverTitle(this.showsToken, this.showsKey);

  /** The warning above the contents says something different when nothing could be confirmed. */
  public readonly handoverNoteKey: string =
    this.deliveryUnconfirmed ? `${DIALOG}handoverNoteUnconfirmed` : `${DIALOG}handoverNote`;

  /**
   * Whether the box ended up with something the Operator can actually copy. It can exist without:
   * a direct delivery whose response carried no token, with no key beside it, leaves only the
   * "not returned" line, and telling the Operator to save that would be nonsense.
   */
  public readonly hasSavableContent: boolean =
    (this.showsToken && !!this.data.credentialToken) || this.showsKey;

  /**
   * Modes that get a status box of their own. The wallet channels always do; `direct` only when it
   * did not deliver, because a failed or unconfirmed direct is a report like theirs rather than a
   * hand-over — in its successful form it lives in the hand-over box above.
   */
  public readonly statusModes: DeliveryMode[] =
    this.orderedModes.filter(mode => mode !== 'direct' || this.outcomeOf('direct') !== 'ok');

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
   * What is known about a declared mode.
   *
   * Silence means different things on either side of the contract. In a successful issuance the
   * issuer only answers 200 when something was delivered, so a mode it said nothing about worked
   * (an older backend says nothing about any of them). Inside a failure, silence is silence: a
   * timeout or a proxy error can hide a dispatch that did happen, and the box must say so instead
   * of picking the reassuring answer.
   */
  public outcomeOf(mode: DeliveryMode): ModeOutcome {
    const status = this.resultByMode.get(mode)?.status;
    if (status === 'failed') return 'failed';
    if (status) return 'ok';
    return this.failed ? 'unconfirmed' : 'ok';
  }

  /** Kept for the callers that only care about the failed verdict. */
  public hasFailed(mode: DeliveryMode): boolean {
    return this.outcomeOf(mode) === 'failed';
  }

  /**
   * Whether the credential can actually be obtained through this mode — which is more than the mode
   * having worked. A QR channel that dispatched is useless to the Operator if the offer URI never
   * reached this dialog: there is then nothing to show and nobody can redeem anything.
   */
  private canDeliver(mode: DeliveryMode): boolean {
    if (this.outcomeOf(mode) !== 'ok') return false;
    if (mode === 'direct') return !!this.data.credentialToken;
    if (mode === 'ui') return !!this.data.credentialOfferUri;
    return true;
  }

  /**
   * The hand-over box is titled by its contents rather than by a delivery mode: the credential and
   * the key get there through independent conditions and either can turn up alone.
   */
  private static handoverTitle(hasToken: boolean, hasKey: boolean): string | null {
    if (hasToken && hasKey) return `${HANDOVER_TITLE}credentialAndKey`;
    if (hasToken) return `${HANDOVER_TITLE}credential`;
    if (hasKey) return `${HANDOVER_TITLE}key`;
    return null;
  }

  private readonly dialogRef = inject(MatDialogRef<IssuanceResultDialogComponent>);

  public close(): void {
    this.dialogRef.close();
  }
}
