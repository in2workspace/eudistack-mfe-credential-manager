import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, switchMap, from, EMPTY, Subject, take, filter } from 'rxjs';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { DialogData } from 'src/app/shared/components/dialog/dialog-data';
import {
  RevokeCredentialDialogComponent,
  RevokeCredentialDialogData,
  RevokeCredentialDialogResult
} from '../components/revoke-credential-dialog/revoke-credential-dialog.component';

/** Panel class of the confirmation and success dialogs below (see styles/ng-material/_dialog.scss). */
const ACTION_DIALOG_STYLE = 'credential-action-dialog';

@Injectable({
  providedIn: 'root'
})
export class CredentialActionsService {

  /**
   * Emits once a revoke / withdraw / archive action has actually hit the
   * backend (for withdraw and archive, once the user dismissed the success dialog). Consumers that
   * stay mounted across the action — the list behind the credential-details drawer — use
   * it to refresh; withdraw and archive also navigate to the list, which remounts it.
   */
  public readonly actionCompleted$ = new Subject<void>();

  /**
   * Emits the issuance id once its revocation was accepted, or the API said it was already revoked.
   * Unlike withdraw and archive, a revocation leaves the drawer open, so the one that shows that
   * attestation reads its detail again to show it as Revoked.
   */
  public readonly credentialRevoked$ = new Subject<string>();

  private readonly credentialProcedureService = inject(CredentialProcedureService);
  private readonly dialog = inject(DialogWrapperService);
  private readonly matDialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  // REVOKE CREDENTIAL

  public openRevokeCredentialDialog(issuanceId: string): void {
    const data: RevokeCredentialDialogData = {
      submit: (reason) => this.credentialProcedureService.revokeCredential(issuanceId, reason)
    };

    this.matDialog
      .open<RevokeCredentialDialogComponent, RevokeCredentialDialogData, RevokeCredentialDialogResult>(
        RevokeCredentialDialogComponent,
        { data, autoFocus: false, panelClass: ['dialog-custom', ACTION_DIALOG_STYLE] }
      )
      .afterClosed()
      .pipe(
        take(1),
        filter((result): result is RevokeCredentialDialogResult => !!result)
      )
      .subscribe(result => {
        this.credentialRevoked$.next(issuanceId);
        this.actionCompleted$.next();
        this.showRevocationResult(result);
      });
  }

  // WITHDRAW CREDENTIAL

  public openWithdrawCredentialDialog(procedureId: string): void {

    const dialogData: DialogData = {
      title: this.translate.instant("credentialDetails.withdrawCredentialConfirm.title"),
      message: this.translate.instant("credentialDetails.withdrawCredentialConfirm.message"),
      confirmationLabel: this.translate.instant("credentialDetails.withdrawCredentialConfirm.confirm"),
      style: ACTION_DIALOG_STYLE,
      confirmationType: 'async',
      status: 'default'
    };

    const withdrawCredentialAfterConfirm = (): Observable<boolean> => {
      return this.withdrawCredential(procedureId);
    }

    this.dialog.openDialogWithCallback(DialogComponent, dialogData, withdrawCredentialAfterConfirm);
  }

  //ARCHIVE CREDENTIAL

  public openArchiveCredentialDialog(procedureId: string): void {

    const dialogData: DialogData = {
      title: this.translate.instant("credentialDetails.archiveCredentialConfirm.title"),
      message: this.translate.instant("credentialDetails.archiveCredentialConfirm.message"),
      confirmationLabel: this.translate.instant("credentialDetails.archiveCredentialConfirm.confirm"),
      style: ACTION_DIALOG_STYLE,
      confirmationType: 'async',
      status: 'default'
    };

    const archiveCredentialAfterConfirm = (): Observable<boolean> => {
      return this.archiveCredential(procedureId);
    }

    this.dialog.openDialogWithCallback(DialogComponent, dialogData, archiveCredentialAfterConfirm);
  }

  //executes backend callback by CREDENTIAL ID
  private executeCredentialBackendAction(
    id: string,
    action: (id: string) => Observable<void>,
    titleKey: string,
    messageKey: string
  ): Observable<boolean> {

    return action(id).pipe(
      switchMap(() => {
        const dialogData: DialogData = {
          title: this.translate.instant(titleKey),
          message: this.translate.instant(messageKey),
          style: ACTION_DIALOG_STYLE,
          confirmationType: 'none',
          status: 'default'
        };

        const dialogRef = this.dialog.openDialog(DialogComponent, dialogData);
        return dialogRef.afterClosed();
      }),
      switchMap(()  => {
        this.actionCompleted$.next();
        return from(this.router.navigate(['/organization/credentials']));
      })
    );
  }

  private executeActionByProcedureId(
    procedureId: string,
    action: (id: string) => Observable<void>,
    titleKey: string,
    messageKey: string
  ): Observable<boolean> {
    if (!procedureId) {
      console.error('No procedure id.');
      return EMPTY;
    }

    return this.executeCredentialBackendAction(procedureId, action, titleKey, messageKey);
  }

  private showRevocationResult(result: RevokeCredentialDialogResult): void {
    const messageKey = result === 'alreadyRevoked'
      ? 'credentialDetails.revokeCredentialSuccess.alreadyRevoked'
      : 'credentialDetails.revokeCredentialSuccess.message';
    const dialogData: DialogData = {
      title: this.translate.instant('credentialDetails.revokeCredentialSuccess.title'),
      message: this.translate.instant(messageKey),
      style: ACTION_DIALOG_STYLE,
      confirmationType: 'none',
      status: 'default'
    };
    this.dialog.openDialog(DialogComponent, dialogData);
  }

  private withdrawCredential(procedureId: string): Observable<boolean> {
    return this.executeActionByProcedureId(
      procedureId,
      (procedureId) => this.credentialProcedureService.withdrawCredential(procedureId),
      "credentialDetails.withdrawCredentialSuccess.title",
      "credentialDetails.withdrawCredentialSuccess.message"
    );
  }

  private archiveCredential(procedureId: string): Observable<boolean> {
    return this.executeActionByProcedureId(
      procedureId,
      (procedureId) => this.credentialProcedureService.archiveCredential(procedureId),
      "credentialDetails.archiveCredentialSuccess.title",
      "credentialDetails.archiveCredentialSuccess.message"
    );
  }
}
