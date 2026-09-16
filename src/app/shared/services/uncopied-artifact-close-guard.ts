import { Injectable, inject, Signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { filter, map, Observable } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { DialogWrapperService } from '../components/dialog/dialog-wrapper/dialog-wrapper.service';
import { DialogComponent } from '../components/dialog/dialog-component/dialog.component';
import { DialogData } from '../components/dialog/dialog-data';

/** What a guarded surface can have left to lose (EUD-233 AD-16). */
export type ArtifactKind = 'credential' | 'privateKey';

export interface UncopiedArtifactCloseGuardHandle {
  /** The one door every dismissal (backdrop/Esc/secondary control) must go through. */
  requestClose(): void;
}

/**
 * Intercepts every way to dismiss a post-emission surface other than its primary "Done" action,
 * while an uncopied artifact (credential and/or private key) is still pending, and confirms before
 * discarding it for good (EUD-233 AD-14).
 *
 * "Done" is deliberately outside this guard's scope: it is only enabled once `pendingArtifacts()`
 * is already empty (AD-16), so there is nothing left to protect by the time it is clickable.
 *
 * **Usage contract:** call `protect()` immediately after `MatDialog.open(...)`, before attaching
 * any other `afterClosed()` subscriber (e.g. before a `switchMap(() => navigateToCredentials())`
 * chain). `afterClosed()` notifies its subscribers in subscription order, and this guard's own
 * cleanup -- which consumes the history sentinel below -- has to run before the host's own
 * post-close navigation, or the operator is left with a dead "atrás" pointing at the same URL
 * they just closed (R-15/R-16).
 */
@Injectable({ providedIn: 'root' })
export class UncopiedArtifactCloseGuard {
  private readonly dialogWrapper = inject(DialogWrapperService);
  private readonly translate = inject(TranslateService);

  public protect<T>(
    dialogRef: MatDialogRef<T>,
    pendingArtifacts: Signal<readonly ArtifactKind[]>
  ): UncopiedArtifactCloseGuardHandle {
    // AD-14: without this, Material closes the dialog on backdrop/Esc before anyone gets to ask.
    dialogRef.disableClose = true;

    let sentinelPushed = false;
    const pushSentinel = (): void => {
      globalThis.history.pushState({ uncopiedArtifactGuard: true }, '', globalThis.location.href);
      sentinelPushed = true;
    };

    const attemptClose = (): void => {
      const pending = pendingArtifacts();
      if (pending.length === 0) {
        dialogRef.close();
        return;
      }
      this.confirmDiscard(pending).subscribe(confirmed => {
        if (confirmed) {
          dialogRef.close();
        }
      });
    };

    // Exactly one sentinel entry per guarded surface (R-15): pushed once here, re-pushed only
    // when a popstate finds something still pending, consumed on any terminal close below.
    pushSentinel();
    const popstateHandler = (): void => {
      const pending = pendingArtifacts();
      sentinelPushed = false; // the back navigation that just fired popstate already consumed it
      if (pending.length === 0) {
        // AC-10.2 / AD-16: nothing to protect -- let the back navigation stand, no confirmation.
        dialogRef.close();
        return;
      }
      pushSentinel(); // neutralize this "atrás", stay in place, then ask
      this.confirmDiscard(pending).subscribe(confirmed => {
        if (confirmed) {
          dialogRef.close();
        }
        // else: nothing further -- already re-pushed, still guarded for a second "atrás".
      });
    };
    globalThis.addEventListener('popstate', popstateHandler);

    const backdropSub = dialogRef.backdropClick().subscribe(() => attemptClose());
    const keydownSub = dialogRef.keydownEvents()
      .pipe(filter(event => event.key === 'Escape'))
      .subscribe(() => attemptClose());

    // Single cleanup point for every terminal close (Done, confirmed discard, or a programmatic
    // close elsewhere) -- AD-14's cardinality requirement: exactly one sentinel, retired here.
    dialogRef.afterClosed().subscribe(() => {
      backdropSub.unsubscribe();
      keydownSub.unsubscribe();
      globalThis.removeEventListener('popstate', popstateHandler);
      if (sentinelPushed) {
        globalThis.history.back();
      }
    });

    return { requestClose: attemptClose };
  }

  private confirmDiscard(pending: readonly ArtifactKind[]): Observable<boolean> {
    const dialogData: DialogData = {
      title: this.translate.instant('credentialIssuance.discardArtifactsConfirm.title'),
      message: this.translate.instant(this.messageKeyFor(pending)),
      confirmationType: 'sync',
      status: 'default',
      confirmationLabel: this.translate.instant('credentialIssuance.discardArtifactsConfirm.confirmationLabel'),
      cancelLabel: this.translate.instant('credentialIssuance.discardArtifactsConfirm.cancelLabel'),
      // EUD-233 fix 2026-09-16: "stay here" (cancel) is the safe choice on a destructive prompt --
      // it should carry the primary color, not "close anyway" (confirm). Opt-in on DialogData,
      // so every other DialogComponent consumer keeps today's default colors untouched.
      emphasizeCancel: true,
    };
    return this.dialogWrapper.openDialog(DialogComponent, dialogData).afterClosed().pipe(
      map(result => result === true)
    );
  }

  /** AC-14.1: names what is pending -- three messages, never a parametrized list (R-14). */
  private messageKeyFor(pending: readonly ArtifactKind[]): string {
    const hasCredential = pending.includes('credential');
    const hasPrivateKey = pending.includes('privateKey');
    if (hasCredential && hasPrivateKey) {
      return 'credentialIssuance.discardArtifactsConfirm.both';
    }
    return hasPrivateKey
      ? 'credentialIssuance.discardArtifactsConfirm.privateKey'
      : 'credentialIssuance.discardArtifactsConfirm.credential';
  }
}
