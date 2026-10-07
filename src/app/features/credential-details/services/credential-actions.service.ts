import { DialogComponent } from 'src/app/shared/components/dialog/dialog-component/dialog.component';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, switchMap, from, EMPTY, Subject } from 'rxjs';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';
import { DialogData } from 'src/app/shared/components/dialog/dialog-data';

/** Panel class of the confirmation dialogs below (see styles/ng-material/_dialog.scss). */
const ACTION_CONFIRM_DIALOG_STYLE = 'action-confirm-dialog';

@Injectable({
  providedIn: 'root'
})
export class CredentialActionsService {

  /**
   * Emits once a revoke / withdraw / archive action has actually hit the
   * backend and the user dismissed the success dialog. Consumers that stay mounted
   * across the action — the credential-details drawer and the list behind it — use
   * it to refresh; the details PAGE does not need it because the navigation below
   * remounts the list.
   */
  public readonly actionCompleted$ = new Subject<void>();

  private readonly credentialProcedureService = inject(CredentialProcedureService);
  private readonly dialog = inject(DialogWrapperService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  // REVOKE CREDENTIAL

  public openRevokeCredentialDialog(issuanceId: string): void {

    const dialogData: DialogData = {
      title: this.translate.instant("credentialDetails.revokeCredentialConfirm.title"),
      message: this.translate.instant("credentialDetails.revokeCredentialConfirm.message"),
      confirmationLabel: this.translate.instant("credentialDetails.revokeCredentialConfirm.confirm"),
      style: ACTION_CONFIRM_DIALOG_STYLE,
      confirmationType: 'async',
      status: 'error'
    };

    const revokeCredentialAfterConfirm = (): Observable<boolean> => {
      return this.revokeCredential(issuanceId);
    }

    this.dialog.openDialogWithCallback(DialogComponent, dialogData, revokeCredentialAfterConfirm);
  }

  // WITHDRAW CREDENTIAL

  public openWithdrawCredentialDialog(procedureId: string): void {

    const dialogData: DialogData = {
      title: this.translate.instant("credentialDetails.withdrawCredentialConfirm.title"),
      message: this.translate.instant("credentialDetails.withdrawCredentialConfirm.message"),
      confirmationLabel: this.translate.instant("credentialDetails.withdrawCredentialConfirm.confirm"),
      style: ACTION_CONFIRM_DIALOG_STYLE,
      confirmationType: 'async',
      status: 'error'
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
      style: ACTION_CONFIRM_DIALOG_STYLE,
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

  private executeActionByCredentialProcedureId(
    procedureId: string,
    action: (procedureId: string) => Observable<void>,
    titleKey: string,
    messageKey: string
  ): Observable<boolean> {
    if(!procedureId){
      console.error("Couldn't get credential list from credential.");
      return EMPTY;
    }

    return this.executeCredentialBackendAction(procedureId, action, titleKey, messageKey);
  }

  private revokeCredential(issuanceId: string): Observable<boolean> {

    return this.executeActionByCredentialProcedureId(
      issuanceId,
      (id) => this.credentialProcedureService.revokeCredential(id),
      "credentialDetails.revokeCredentialSuccess.title",
      "credentialDetails.revokeCredentialSuccess.message"
    );
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
