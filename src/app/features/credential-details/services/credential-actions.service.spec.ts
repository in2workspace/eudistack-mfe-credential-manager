import { DialogComponent } from './../../../shared/components/dialog/dialog-component/dialog.component';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Observable, Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { CredentialActionsService } from './credential-actions.service';
import {
  RevokeCredentialDialogComponent,
  RevokeCredentialDialogData,
  RevokeCredentialDialogResult
} from '../components/revoke-credential-dialog/revoke-credential-dialog.component';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { DialogWrapperService } from 'src/app/shared/components/dialog/dialog-wrapper/dialog-wrapper.service';

describe('CredentialActionsService', () => {
  let service: CredentialActionsService;
  let mockCredentialProcedure: Partial<CredentialProcedureService>;
  let mockDialog: Partial<DialogWrapperService>;
  let mockMatDialog: { open: jest.Mock };
  let revokeDialogClosed$: Subject<RevokeCredentialDialogResult | undefined>;
  let mockRouter: Partial<Router>;
  let mockTranslate: Partial<TranslateService>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCredentialProcedure = {
      revokeCredential: jest.fn().mockReturnValue(of(void 0)),
      archiveCredential: jest.fn().mockReturnValue(of(void 0)),
    };

    const afterClosedSpy = jest.fn().mockReturnValue(of(true));
    mockDialog = {
      openDialogWithCallback: jest.fn(),
      openDialog: jest.fn().mockReturnValue({ afterClosed: afterClosedSpy }),
    };

    revokeDialogClosed$ = new Subject<RevokeCredentialDialogResult | undefined>();
    mockMatDialog = {
      open: jest.fn().mockReturnValue({ afterClosed: () => revokeDialogClosed$.asObservable() }),
    };

    mockRouter = {
      navigate: jest.fn().mockResolvedValue(true),
    };

    mockTranslate = {
      instant: jest.fn().mockImplementation((key: string) => key),
    };

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    TestBed.configureTestingModule({
      providers: [
        CredentialActionsService,
        { provide: CredentialProcedureService, useValue: mockCredentialProcedure },
        { provide: DialogWrapperService, useValue: mockDialog },
        { provide: MatDialog, useValue: mockMatDialog },
        { provide: Router, useValue: mockRouter },
        { provide: TranslateService, useValue: mockTranslate },
      ],
    });

    service = TestBed.inject(CredentialActionsService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('openRevokeCredentialDialog', () => {
    const issuanceId = '3f2b8c1e-0a52-4d0e-9b7a-0a1b2c3d4e5f';

    function openedData(): RevokeCredentialDialogData {
      return mockMatDialog.open.mock.calls[0][1].data;
    }

    it('opens its own dialog, not the generic confirmation, with the action dialog look', () => {
      service.openRevokeCredentialDialog(issuanceId);

      expect(mockMatDialog.open).toHaveBeenCalledTimes(1);
      const [component, config] = mockMatDialog.open.mock.calls[0];
      expect(component).toBe(RevokeCredentialDialogComponent);
      expect(config.panelClass).toEqual(['dialog-custom', 'credential-action-dialog']);
      expect(mockDialog.openDialogWithCallback).not.toHaveBeenCalled();
    });

    it('does not ask the API until the dialog submits', () => {
      service.openRevokeCredentialDialog(issuanceId);

      expect(mockCredentialProcedure.revokeCredential).not.toHaveBeenCalled();
    });

    it('submits the reason of the operator for that issuance', done => {
      service.openRevokeCredentialDialog(issuanceId);

      openedData().submit('Holder left the organization').subscribe(() => {
        expect(mockCredentialProcedure.revokeCredential).toHaveBeenCalledWith(issuanceId, 'Holder left the organization');
        done();
      });
    });

    it('hands the API error to the dialog untouched', done => {
      const problem = new Error('409 Conflict');
      (mockCredentialProcedure.revokeCredential as jest.Mock).mockReturnValue(new Observable(obs => obs.error(problem)));
      service.openRevokeCredentialDialog(issuanceId);

      openedData().submit('reason').subscribe({
        next: () => fail('should have errored'),
        error: (err: Error) => {
          expect(err).toBe(problem);
          done();
        },
      });
    });

    it('on an accepted revocation: tells the drawer and the list, shows the success message and stays where it is', () => {
      const revoked: string[] = [];
      const completed = jest.fn();
      service.credentialRevoked$.subscribe(id => revoked.push(id));
      service.actionCompleted$.subscribe(completed);
      service.openRevokeCredentialDialog(issuanceId);

      revokeDialogClosed$.next('revoked');

      expect(revoked).toEqual([issuanceId]);
      expect(completed).toHaveBeenCalledTimes(1);
      expect(mockDialog.openDialog).toHaveBeenCalledWith(
        DialogComponent,
        expect.objectContaining({
          title: 'credentialDetails.revokeCredentialSuccess.title',
          message: 'credentialDetails.revokeCredentialSuccess.message',
          style: 'credential-action-dialog',
          confirmationType: 'none',
          status: 'default',
        })
      );
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('when it was already revoked: refreshes the same way and shows the already revoked message', () => {
      const revoked: string[] = [];
      service.credentialRevoked$.subscribe(id => revoked.push(id));
      service.openRevokeCredentialDialog(issuanceId);

      revokeDialogClosed$.next('alreadyRevoked');

      expect(revoked).toEqual([issuanceId]);
      expect(mockDialog.openDialog).toHaveBeenCalledWith(
        DialogComponent,
        expect.objectContaining({ message: 'credentialDetails.revokeCredentialSuccess.alreadyRevoked' })
      );
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('when the dialog is cancelled or closed: changes nothing and requests nothing', () => {
      const revoked = jest.fn();
      const completed = jest.fn();
      service.credentialRevoked$.subscribe(revoked);
      service.actionCompleted$.subscribe(completed);
      service.openRevokeCredentialDialog(issuanceId);

      revokeDialogClosed$.next(undefined);

      expect(revoked).not.toHaveBeenCalled();
      expect(completed).not.toHaveBeenCalled();
      expect(mockDialog.openDialog).not.toHaveBeenCalled();
      expect(mockCredentialProcedure.revokeCredential).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe.each([
    ['withdraw', (id: string) => service.openWithdrawCredentialDialog(id)],
    ['archive', (id: string) => service.openArchiveCredentialDialog(id)],
  ])('%s confirmation dialog', (action, openDialog) => {
    it('names its confirm button after the action and uses the action confirmation look', () => {
      openDialog('3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c');

      const [, dialogData] = (mockDialog.openDialogWithCallback as jest.Mock).mock.calls[0];
      expect(dialogData.confirmationLabel).toBe(`credentialDetails.${action}CredentialConfirm.confirm`);
      expect(dialogData.cancelLabel).toBeUndefined(); // the shared "Cancel"
      expect(dialogData.style).toBe('credential-action-dialog');
    });

    // An 'error' status would paint the confirm button red (mat-warn), which the
    // credential-action-dialog style no longer overrides so that a failed action's Close stays red.
    it('opens with the default status so its confirm button stays primary', () => {
      openDialog('3f1c2a9e-7b4d-4e2a-9c1f-5d6e7f8a9b0c');

      const [, dialogData] = (mockDialog.openDialogWithCallback as jest.Mock).mock.calls[0];
      expect(dialogData.status).toBe('default');
    });
  });

  describe('executeActionByProcedureId', () => {
    it('should error and return EMPTY if no procedureId', done => {
      const result$ = service['executeActionByProcedureId']('', jest.fn(), 'tKey', 'mKey');
      result$.subscribe({
        complete: () => {
          expect(consoleErrorSpy).toHaveBeenCalledWith('No procedure id.');
          done();
        }
      });
    });

    it('should execute full flow on valid procedureId', done => {
      const procId = 'procABC';
      const actionSpy = jest.fn().mockReturnValue(of(void 0));
      const titleKey = 'titleKey';
      const messageKey = 'messageKey';

      service['executeActionByProcedureId'](procId, actionSpy, titleKey, messageKey)
        .subscribe((res) => {
          expect(actionSpy).toHaveBeenCalledWith(procId);
          expect(mockDialog.openDialog).toHaveBeenCalledWith(DialogComponent, expect.objectContaining({ title: titleKey, message: messageKey }));
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/organization/credentials']);
          expect(res).toBe(true);
          done();
        });
    });
  });

  describe('executeActionByCredentialId', () => {
    // todo test
    // it('should error and return EMPTY if no credentialId', done => {
    //   const result$ = service['executeActionByCredentialId']('', jest.fn(), 'tKey', 'mKey');
    //   result$.subscribe({
    //     complete: () => {
    //       expect(consoleErrorSpy).toHaveBeenCalledWith("Couldn't get credential list from credential.");
    //       done();
    //     }
    //   });
    // });

    // todo test
    // it('should execute full flow on valid credentialId', done => {
    //   const credId = 'credDEF';
    //   const actionSpy = jest.fn().mockReturnValue(of(void 0));
    //   const titleKey = 'tKey2';
    //   const messageKey = 'mKey2';

    //   service['executeActionByCredentialId'](credId, actionSpy, titleKey, messageKey)
    //     .subscribe((res) => {
    //       expect(actionSpy).toHaveBeenCalledWith(credId);
    //       expect(mockDialog.openDialog).toHaveBeenCalledWith(DialogComponent, expect.objectContaining({ title: titleKey, message: messageKey }));
    //       expect(mockRouter.navigate).toHaveBeenCalledWith(['/organization/credentials']);
    //       expect(window.location.reload).toHaveBeenCalled();
    //       expect(res).toBe(true);
    //       done();
    //     });
    // });
  });

  describe('openArchiveCredentialDialog', () => {
    it('should call openDialogWithCallback with correct DialogData', () => {
      const issuanceId = 'cred789';
      service.openArchiveCredentialDialog(issuanceId);
      expect(mockDialog.openDialogWithCallback).toHaveBeenCalledTimes(1);
      const [_, dialogData, callback] = (mockDialog.openDialogWithCallback as jest.Mock).mock.calls[0];
      expect(dialogData.title).toBe('credentialDetails.archiveCredentialConfirm.title');
      expect(dialogData.message).toBe('credentialDetails.archiveCredentialConfirm.message');
      expect(dialogData.confirmationType).toBe('async');
      expect(typeof callback).toBe('function');
    });
  });

  describe('archiveCredential (callback behaviour)', () => {
    it('callback success: should call credentialProcedureService.archiveCredential with the procedureId', done => {
      const procedureId = 'proc-archive-001';
      service.openArchiveCredentialDialog(procedureId);

      const [_, __, callback] = (mockDialog.openDialogWithCallback as jest.Mock).mock.calls[0];
      (callback() as any).subscribe(() => {
        expect(mockCredentialProcedure.archiveCredential).toHaveBeenCalledWith(procedureId);
        expect(mockDialog.openDialog).toHaveBeenCalled();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/organization/credentials']);
        done();
      });
    });

    it('callback no confirmation: should NOT call archiveCredential if dialog is not confirmed', () => {
      const procedureId = 'proc-archive-002';
      service.openArchiveCredentialDialog(procedureId);
      expect(mockCredentialProcedure.archiveCredential).not.toHaveBeenCalled();
    });

    it('callback 5xx error: callback should propagate error from archiveCredential', done => {
      const procedureId = 'proc-archive-003';
      const serverError = new Error('500 Server Error');
      (mockCredentialProcedure.archiveCredential as jest.Mock).mockReturnValue(
        new Observable((obs) => obs.error(serverError))
      );

      service.openArchiveCredentialDialog(procedureId);
      const [_, __, callback] = (mockDialog.openDialogWithCallback as jest.Mock).mock.calls[0];
      (callback() as any).subscribe({
        next: () => fail('should have errored'),
        error: (err: Error) => {
          expect(err).toBe(serverError);
          done();
        },
      });
    });
  });
});
