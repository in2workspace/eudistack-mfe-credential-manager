import { Component, computed, input, output } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { DELIVERY_MODE_OPTIONS, DeliveryModeToken } from 'src/app/core/models/entity/lear-credential-issuance';
import { ChannelOutcome } from 'src/app/core/models/entity/issuance-channel-outcome';
import { CopyableFieldComponent } from '../copyable-field/copyable-field.component';
import { CredentialOfferQrComponent } from '../credential-offer-qr/credential-offer-qr.component';

interface DeliveryOutcomeEntry {
  mode: DeliveryModeToken;
  outcome: ChannelOutcome;
  labelKey: string;
}

/**
 * Per-channel delivery result, in the Story's fixed presentation order (EUD-233 AD-10:
 * `DELIVERY_RESULT_ORDER`), never the iteration order of an outcomes map -- a channel's position
 * must not depend on which one happened to fail (EC-07).
 *
 * One component, two hosts (AD-8): `DirectCredentialResultDialogComponent` and the
 * extended `CredentialOfferDialogComponent` both render this instead of each keeping
 * its own copy of the ordering and the delivered/failed presentation.
 *
 * Renders only the modes the caller actually requested -- `outcomes` already comes from
 * `resolveChannelOutcomes(responses, requestedModes)`, which has exactly one entry per requested
 * mode, so there is nothing to filter here beyond restoring the fixed order. `'missing'` renders the same as `'failed'`: both mean "nothing arrived on this
 * channel", and the Operator has no use for the distinction between the two absence causes.
 *
 * Rendered as one bordered box per mode: green border and
 * copy on delivery, red on failure, never the neutral/grey default. Only this component's own
 * per-mode presentation changed -- the gating that decides WHETHER it renders at all stays exactly
 * as each host already had it (`DirectCredentialResultDialogComponent.showOutcomes` = more than one
 * requested channel; `CredentialOfferDialogComponent.showOutcomes` = more than one
 * channel OR any channel not delivered).
 *
 * The `direct` and `ui` boxes embed the actual artifact instead
 * of a generic "delivered" line, so it is no longer duplicated above this list -- the signed
 * credential (`signedCredential`) inside the `direct` box, the QR (`credentialOfferUri`) inside the
 * `ui` box. Both inputs are optional and only ever consumed when the matching mode is present AND
 * delivered; a host only passes them when it has ALSO stopped rendering its own standalone copy
 * (i.e. only while its `showOutcomes` is true -- this component has no visibility of that flag
 * itself, the host owns the gating). `email` never has an embeddable artifact, so it always falls
 * back to the generic per-mode text, same as `direct`/`ui` do when their data is absent despite a
 * `delivered` outcome (a defensive fallback, not an expected path).
 */
@Component({
  selector: 'app-delivery-outcome-list',
  imports: [MatIcon, TranslatePipe, CopyableFieldComponent, CredentialOfferQrComponent],
  templateUrl: './delivery-outcome-list.component.html',
  styleUrl: './delivery-outcome-list.component.scss'
})
export class DeliveryOutcomeListComponent {
  public readonly outcomes = input.required<ReadonlyMap<DeliveryModeToken, ChannelOutcome>>();
  /** The `direct` box's own artifact, in place of the generic "delivered" text. See class doc. */
  public readonly signedCredential = input<string>();
  /** The `ui` box's own artifact, in place of the generic "delivered" text. See class doc. */
  public readonly credentialOfferUri = input<string>();

  /** Bubbles the embedded `app-copyable-field`'s events -- the host still owns Done-gating (AD-16). */
  public readonly credentialCopied = output<void>();
  public readonly credentialCopyFailed = output<void>();

  /**
   * Clipboard-clear TTL for the embedded credential (F4, 2026-09-17 hardening): the signed VC
   * carries mandator PII (`commonName`, `email`, `serialNumber`, `organizationIdentifier` for
   * `learcredential.machine`) and is holder-bound, not a bearer secret, but leaving it on a shared
   * clipboard indefinitely is the same exposure class NFR-S-EUD168-04(b) already closes for the
   * private key. Same duration, same mechanism (`CopyableFieldComponent`), reused rather than
   * treating the credential as exempt because it happens to render in a different component.
   */
  private static readonly CREDENTIAL_CLIPBOARD_TTL_MS = 60_000;
  protected readonly credentialClipboardTtlMs = DeliveryOutcomeListComponent.CREDENTIAL_CLIPBOARD_TTL_MS;

  protected readonly orderedEntries = computed<DeliveryOutcomeEntry[]>(() => {
    const outcomes = this.outcomes();
    return DELIVERY_MODE_OPTIONS
      .filter(option => outcomes.has(option.value))
      .map(option => ({ mode: option.value, outcome: outcomes.get(option.value)!, labelKey: option.labelKey }));
  });

  protected isDelivered(outcome: ChannelOutcome): boolean {
    return outcome === 'delivered';
  }

  /** Whether the `direct` box embeds the signed credential instead of the generic text. */
  protected showsCredential(entry: DeliveryOutcomeEntry): boolean {
    return entry.mode === 'direct' && this.isDelivered(entry.outcome) && !!this.signedCredential();
  }

  /** Whether the `ui` box embeds the QR instead of the generic text. */
  protected showsOffer(entry: DeliveryOutcomeEntry): boolean {
    return entry.mode === 'ui' && this.isDelivered(entry.outcome) && !!this.credentialOfferUri();
  }

  /** The per-mode, per-outcome body copy -- distinct wording for each of the three channels. */
  protected bodyKeyFor(entry: DeliveryOutcomeEntry): string {
    return `credentialIssuance.deliveryOutcome.${entry.mode}.${this.isDelivered(entry.outcome) ? 'delivered' : 'failed'}`;
  }
}
