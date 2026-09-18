import { Component, EventEmitter, input, Output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CopyableFieldComponent } from '../copyable-field/copyable-field.component';

/**
 * The private-key handoff, shared by both forms of the post-emission surface (EUD-233 AD-8): the
 * second artifact of `DirectCredentialResultDialogComponent` (Task 22) and the apartado above the
 * AS-IS Wallet content in the extended `CredentialOfferDialogComponent` (Task 24). One component,
 * two hosts -- neither may fork its own copy of this rendering (`technical-design.md` AD-8).
 *
 * `privateKeyHex` absent renders the AC-10.1/AC-10.2 non-blocking notice instead of a copyable
 * field: the key generated for this attempt is no longer available in the client (e.g. a reload
 * between submit and response destroyed the root store). This component only decides *how* to
 * render that fact -- whether the missing key means anything for the host's `Done` gating or its
 * `UncopiedArtifactCloseGuard` is the host's call (AD-16's `pendingArtifacts` never counts an
 * artifact this component never had to offer).
 */
@Component({
  selector: 'app-holder-private-key-section',
  imports: [CopyableFieldComponent, TranslatePipe],
  templateUrl: './holder-private-key-section.component.html',
  styleUrl: './holder-private-key-section.component.scss'
})
export class HolderPrivateKeySectionComponent {
  /**
   * The private key's clipboard TTL (NFR-S-EUD168-04(b), R-4). Hardcoded here, not exposed as an
   * input: this component's only reason to exist is the private key, so the requirement is a fact
   * of the component, not something a caller could forget to pass.
   */
  private static readonly PRIVATE_KEY_CLIPBOARD_TTL_MS = 60_000;
  protected readonly clipboardTtlMs = HolderPrivateKeySectionComponent.PRIVATE_KEY_CLIPBOARD_TTL_MS;

  /** Undefined means AC-10.1/AC-10.2: the key is no longer available in the client. */
  public readonly privateKeyHex = input<string>();

  /** Fired once the key is copied -- the host's signal to drop 'privateKey' from `pendingArtifacts`. */
  @Output() public readonly copiedChange = new EventEmitter<void>();

  /**
   * Fired when the inner field's clipboard write rejects (ES-07.1, ES-07.2). The host renders this
   * as its own perceptible, attributable notice -- "attributable to the key block, unambiguous
   * with respect to the other block" (ES-07.1's literal wording) is only true if the host knows
   * *which* block failed, which is exactly what forwarding this event (rather than swallowing it)
   * makes possible.
   */
  @Output() public readonly copyFailedChange = new EventEmitter<void>();
}
