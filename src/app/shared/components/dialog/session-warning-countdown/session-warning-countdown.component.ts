import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

const TOTAL_SECONDS = 120;

/**
 * Embedded content (via ComponentPortal, see AuthService.showSessionWarning)
 * for the "session expiring soon" dialog: the message plus a shrinking
 * progress bar, matching the countdown already used by the Verifier's own
 * login page (eudistack-mfe-login LoginComponent) for QR session expiry.
 *
 * Purely visual — AuthService's own warningTimer is what actually decides
 * when the dialog opens and (via SilentRenewFailed/renewal) when it closes;
 * a few seconds of drift between this bar and the real deadline is the same
 * trade-off the Verifier's own countdown already accepts.
 */
@Component({
  selector: 'app-session-warning-countdown',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './session-warning-countdown.component.html',
  styleUrl: './session-warning-countdown.component.scss',
})
export class SessionWarningCountdownComponent implements OnInit, OnDestroy {
  remainingSeconds = TOTAL_SECONDS;
  countdownPercentage = 100;

  private countdownInterval?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.countdownInterval = setInterval(() => {
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
      this.countdownPercentage = (this.remainingSeconds / TOTAL_SECONDS) * 100;
      if (this.remainingSeconds <= 0) {
        this.clearCountdown();
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    this.clearCountdown();
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
  }
}
