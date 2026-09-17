import { Component, EventEmitter, input, OnDestroy, Output, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * A labelled, read-only value with a copy button, for values the Operator has to move somewhere
 * safe: a credential token, a private key (EUD-233 AD-10, ported and adapted from
 * `feat/direct-delivery`).
 *
 * Two independent timers, both restarted (not stacked) on every copy: the visual "Copied!"
 * confirmation always resets after 2 s regardless of the artifact (AS-IS, `technical-design.md`
 * §2.4) and is purely cosmetic -- it does not revert the `copied` output already emitted, which is
 * monotonic per artifact (AD-16). The clipboard-clear TTL is a *different*, optional concern:
 * absent by default, but the input is **required by convention** whenever this field carries the
 * private key (AD-10, R-4, NFR-S-EUD168-04(b)) -- there is no compiler enforcement of that
 * convention, only the two hosts that render the key section (Tasks 22/24) always supplying it.
 */
@Component({
  selector: 'app-copyable-field',
  imports: [MatIcon, TranslatePipe],
  templateUrl: './copyable-field.component.html',
  styleUrl: './copyable-field.component.scss'
})
export class CopyableFieldComponent implements OnDestroy {
  /** i18n key for the label above the value. */
  public readonly labelKey = input.required<string>();
  /** i18n key for the confirmation shown after copying. */
  public readonly copiedLabelKey = input<string>('credentialIssuance.credential-offer-dialog.copied');
  public readonly value = input.required<string>();
  /**
   * Milliseconds before this field overwrites the clipboard with an empty string after a copy.
   * Omitted: no clipboard-clear timer at all. Both the private key
   * (`HolderPrivateKeySectionComponent`) and the signed credential (`DirectCredentialResultDialogComponent`,
   * `DeliveryOutcomeListComponent`) supply 60s as of the 2026-09-17 hardening -- the credential
   * carries mandator PII and is no longer treated as exempt from clipboard exposure just because
   * it isn't the key itself. See the class doc for when it must be supplied.
   */
  public readonly clipboardTtlMs = input<number>();

  /** Drives the "Copied!" confirmation only -- not consulted for any gating decision. */
  protected readonly hasCopied = signal(false);

  /** Emitted once per successful copy -- the host's signal for `pendingArtifacts` (AD-16). */
  @Output() public readonly copied = new EventEmitter<void>();
  /** Emitted when `navigator.clipboard.writeText` rejects (ES-05, ES-07.1, ES-07.2). */
  @Output() public readonly copyFailed = new EventEmitter<void>();

  private visualResetTimer?: ReturnType<typeof setTimeout>;
  private clipboardClearTimer?: ReturnType<typeof setTimeout>;

  public async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.value());
    } catch {
      this.copyFailed.emit();
      return;
    }
    this.hasCopied.set(true);
    this.copied.emit();
    this.scheduleVisualReset();
    this.scheduleClipboardClearIfNeeded();
  }

  public ngOnDestroy(): void {
    clearTimeout(this.visualResetTimer);
    // Perform the pending clipboard clear now rather than merely cancelling it (same precedent as
    // the retired KeyGeneratorComponent): the dominant path is the Operator copying and then
    // closing the host dialog well before this timer would otherwise fire on its own.
    if (this.clipboardClearTimer !== undefined) {
      clearTimeout(this.clipboardClearTimer);
      this.clipboardClearTimer = undefined;
      navigator.clipboard.writeText('').catch(() => {
        // Best effort: by destroy time the Operator has typically moved focus elsewhere, which
        // makes writeText reject. Nothing actionable to do with that here.
      });
    }
  }

  private scheduleVisualReset(): void {
    clearTimeout(this.visualResetTimer);
    this.visualResetTimer = setTimeout(() => this.hasCopied.set(false), 2000);
  }

  private scheduleClipboardClearIfNeeded(): void {
    const ttl = this.clipboardTtlMs();
    if (ttl === undefined) {
      return;
    }
    if (this.clipboardClearTimer !== undefined) {
      clearTimeout(this.clipboardClearTimer);
    }
    this.clipboardClearTimer = setTimeout(() => {
      this.clipboardClearTimer = undefined;
      navigator.clipboard.writeText('').catch(() => {});
    }, ttl);
  }
}
