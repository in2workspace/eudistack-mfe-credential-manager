import { Component, input, OnDestroy } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * A labelled, read-only value with a copy button, for values the Operator has to move somewhere
 * safe: a credential token, a private key.
 *
 * After a successful copy a confirmation replaces nothing and appears below, for a couple of
 * seconds. The timer is cleared on destroy — these live in a dialog the Operator usually closes
 * right after copying, and a pending callback on a destroyed component is a leak.
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
  public readonly copiedLabelKey = input<string>('credentialIssuance.issuance-result-dialog.copied');
  public readonly value = input.required<string>();

  public copied = false;
  private resetTimer?: ReturnType<typeof setTimeout>;

  public copy(): void {
    navigator.clipboard.writeText(this.value());
    this.copied = true;
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.copied = false, 2000);
  }

  public ngOnDestroy(): void {
    clearTimeout(this.resetTimer);
  }
}
