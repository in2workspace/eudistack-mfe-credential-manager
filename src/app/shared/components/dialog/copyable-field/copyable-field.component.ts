import { Component, EventEmitter, input, Output, signal, inject } from '@angular/core';
import { ClipboardService } from '../../../services/clipboard.service';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * A labelled, read-only value with a copy button, for values the Operator has to move somewhere
 * safe: a credential token, a private key (EUD-233 AD-10, ported and adapted from
 * `feat/direct-delivery`).
 *
 * Every value this component renders is sensitive, so it is masked behind a password-style input
 * by default; a visibility toggle next to the copy button reveals it. Masking is purely a display
 * concern -- `copy()` always sends the real `value()` to the ClipboardService, never the masked text.
 *
 * The visual "Copied!" confirmation replaces the copy button's own label once set and never
 * reverts to "Copy" -- the button stays clickable and every further click still copies (and
 * re-emits `copied`, monotonic per artifact per AD-16).
 *
 * Clipboard lifetime management is intentionally handled by the root-level ClipboardService rather
 * than by this component. This keeps the clipboard-clear timer independent from the component
 * lifecycle, so closing a dialog or destroying this component does not clear the clipboard.
 *
 * When a clipboard TTL is provided, the ClipboardService starts or resets the global clear timer
 * after every successful copy. This means that copying a value from another CopyableFieldComponent
 * also resets the timer, since the system clipboard is a shared resource.
 */
@Component({
  selector: 'app-copyable-field',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './copyable-field.component.html',
  styleUrl: './copyable-field.component.scss'
})
export class CopyableFieldComponent {
  public readonly labelKey = input.required<string>();
  public readonly descriptionKey = input<string>();
  public readonly copiedLabelKey = input<string>('credentialIssuance.credential-offer-dialog.copied');
  public readonly value = input.required<string>();
 /**
   * Optional clipboard lifetime in milliseconds.
   *
   * When provided, the ClipboardService clears the clipboard after the specified delay.
   * The timer is owned by the root ClipboardService and is therefore independent of this
   * component's lifecycle. In particular, destroying this component must not clear the clipboard.
   *
   * Both the private key (`HolderPrivateKeySectionComponent`) and the signed credential
   * (`DirectCredentialResultDialogComponent`, `DeliveryOutcomeListComponent`) supply 60s as of
   * the 2026-09-17 hardening -- the credential carries mandator PII and is no longer treated as
   * exempt from clipboard exposure just because it isn't the key itself.
   */
  public readonly clipboardTtlMs = input<number>();

  protected readonly hasCopied = signal(false);
  protected readonly revealed = signal(false);

  @Output() public readonly copied = new EventEmitter<void>();
  @Output() public readonly copyFailed = new EventEmitter<void>();

  private readonly clipboardService = inject(ClipboardService);

  protected toggleVisibility(): void {
    this.revealed.set(!this.revealed());
  }

  public async copy(): Promise<void> {
    try {
      await this.clipboardService.copy(
        this.value(),
        this.clipboardTtlMs(),
      );
    } catch {
      this.copyFailed.emit();
      return;
    }

    this.hasCopied.set(true);
    this.copied.emit();
  }
}
