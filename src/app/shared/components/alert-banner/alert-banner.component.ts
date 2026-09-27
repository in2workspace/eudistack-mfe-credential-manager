import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Inline, non-blocking system notice (EUD-233 AD-12) -- introduced for ES-08's "catalogue
 * unreadable" notice, but not specific to it: any caller that needs to tell the Operator
 * something without stopping them can reuse this.
 *
 * Deliberately different from `ToastService`/`MatSnackBar`: no auto-dismiss, because a notice
 * that can vanish before the Operator gets to the relevant control fails "know what to expect
 * before filling in the form" (ES-08). `role="status"` + `aria-live="polite"` announce it without
 * moving focus; the dismiss button is a standard `mat-icon-button` (48x48, already ≥ the 44x44
 * target NFR-S-233-01 asks for) and needs no extra keyboard wiring -- a native `<button>` already
 * responds to Enter/Space.
 */
@Component({
  selector: 'app-alert-banner',
  imports: [MatIconButton, MatIcon, TranslatePipe],
  templateUrl: './alert-banner.component.html',
  styleUrl: './alert-banner.component.scss'
})
export class AlertBannerComponent {
  /** i18n key for the notice body -- the caller decides the wording, this component only frames it. */
  @Input({ required: true }) public messageKey!: string;

  /** i18n key for the dismiss button's accessible name -- reuses the generic dialog close label. */
  @Input() public dismissLabelKey = 'dialog.close';

  @Output() public dismissed = new EventEmitter<void>();

  protected readonly isDismissed = signal(false);

  public dismiss(): void {
    this.isDismissed.set(true);
    this.dismissed.emit();
  }
}
