import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, of, Subject, throwError } from 'rxjs';
import {
  MAX_REVOCATION_REASON_LENGTH,
  RevokeCredentialDialogComponent,
  RevokeCredentialDialogData
} from './revoke-credential-dialog.component';

const EMOJI = '\u{1F600}'; // one code point, two UTF-16 units

const problem = (type: string, status: number) => new HttpErrorResponse({ status, error: { type } });

describe('RevokeCredentialDialogComponent', () => {
  let fixture: ComponentFixture<RevokeCredentialDialogComponent>;
  let dialogRef: { close: jest.Mock; disableClose: boolean };
  let submit: jest.Mock<Observable<void>, [string]>;

  async function createComponent(): Promise<void> {
    dialogRef = { close: jest.fn(), disableClose: false };
    const data: RevokeCredentialDialogData = { submit };

    await TestBed.configureTestingModule({
      imports: [RevokeCredentialDialogComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RevokeCredentialDialogComponent);
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement;
  const field = (): HTMLTextAreaElement => el().querySelector('#revoke-reason') as HTMLTextAreaElement;
  const confirmButton = (): HTMLButtonElement => el().querySelector('#revoke-confirm') as HTMLButtonElement;
  const cancelButton = (): HTMLButtonElement => el().querySelector('#revoke-cancel') as HTMLButtonElement;
  const alert = (): HTMLElement | null => el().querySelector('[role="alert"]');
  const remaining = (): number => (fixture.componentInstance as unknown as { remaining: () => number }).remaining();

  function type(text: string): void {
    field().value = text;
    field().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    submit = jest.fn((_reason: string) => of(undefined as void));
  });

  afterEach(() => TestBed.resetTestingModule());

  describe('content', () => {
    beforeEach(createComponent);

    it('warns that the action cannot be undone, asks for the reason and says it is internal', () => {
      const text = el().textContent ?? '';

      expect(text).toContain('credentialDetails.revokeDialog.warning');
      expect(text).toContain('credentialDetails.revokeDialog.reasonLabel');
      expect(text).toContain('credentialDetails.revokeDialog.internalNote');
    });

    it('marks the reason as required and describes it by the counter and the note', () => {
      expect(field().required).toBe(true);
      expect(field().getAttribute('aria-describedby')).toBe('revoke-reason-counter revoke-reason-note');
    });

    it('starts with the whole limit left', () => {
      expect(MAX_REVOCATION_REASON_LENGTH).toBe(280);
      expect(remaining()).toBe(280);
    });
  });

  describe('confirm button', () => {
    beforeEach(createComponent);

    it('is disabled without a reason', () => {
      expect(confirmButton().disabled).toBe(true);
    });

    it.each(['', '   ', '\n\t  '])('is disabled for the reason %j', text => {
      type(text);

      expect(confirmButton().disabled).toBe(true);
    });

    it('does not submit when clicked while disabled', () => {
      type('   ');

      confirmButton().click();

      expect(submit).not.toHaveBeenCalled();
    });

    it('is enabled with a reason', () => {
      type('Holder left the organization');

      expect(confirmButton().disabled).toBe(false);
    });
  });

  describe('reason counter and limit', () => {
    beforeEach(createComponent);

    it('shows how many characters are left', () => {
      type('abcde');

      expect(remaining()).toBe(275);
    });

    it('counts an emoji as one character, like the Issuer', () => {
      type(`${EMOJI}${EMOJI}`);

      expect(remaining()).toBe(278);
    });

    it('accepts exactly 280 characters', () => {
      type('x'.repeat(280));

      expect(field().value).toHaveLength(280);
      expect(remaining()).toBe(0);
    });

    it('cuts a longer pasted text to 280 characters', () => {
      type('x'.repeat(300));

      expect(field().value).toHaveLength(280);
      expect(remaining()).toBe(0);
    });

    it('accepts 280 emojis although they take 560 UTF-16 units', () => {
      type(EMOJI.repeat(280));

      expect(Array.from(field().value)).toHaveLength(280);
      expect(remaining()).toBe(0);
    });

    it('never cuts an emoji in half when pasting', () => {
      type(`${'x'.repeat(279)}${EMOJI}tail`);

      expect(Array.from(field().value)).toHaveLength(280);
      expect(field().value.endsWith(EMOJI)).toBe(true);
    });
  });

  describe('cancel', () => {
    beforeEach(createComponent);

    it('closes without a result and asks nothing of the API', () => {
      type('some reason');

      cancelButton().click();

      expect(dialogRef.close).toHaveBeenCalledWith();
      expect(submit).not.toHaveBeenCalled();
    });
  });

  describe('confirmation', () => {
    beforeEach(createComponent);

    it('submits the reason once, without the spaces around it', () => {
      type('  Holder left the organization \n');

      confirmButton().click();

      expect(submit).toHaveBeenCalledTimes(1);
      expect(submit).toHaveBeenCalledWith('Holder left the organization');
    });

    it('closes as revoked when the API accepts it', () => {
      type('reason');

      confirmButton().click();

      expect(dialogRef.close).toHaveBeenCalledWith('revoked');
      expect(alert()).toBeNull();
    });

    describe('while the request is in flight', () => {
      let inFlight$: Subject<void>;

      beforeEach(() => {
        inFlight$ = new Subject<void>();
        submit.mockReturnValue(inFlight$.asObservable());
        type('reason');
        confirmButton().click();
        fixture.detectChanges();
      });

      it('disables confirm, cancel and the field, and blocks closing', () => {
        expect(confirmButton().disabled).toBe(true);
        expect(cancelButton().disabled).toBe(true);
        expect(field().disabled).toBe(true);
        expect(dialogRef.disableClose).toBe(true);
      });

      it('sends a single request when confirm is pressed twice', () => {
        confirmButton().click();
        confirmButton().click();

        expect(submit).toHaveBeenCalledTimes(1);
      });

      it('does not even call confirm() a second time', () => {
        (fixture.componentInstance as unknown as { confirm: () => void }).confirm();

        expect(submit).toHaveBeenCalledTimes(1);
      });

      it('closes as revoked once the API answers', () => {
        inFlight$.next();

        expect(dialogRef.close).toHaveBeenCalledWith('revoked');
      });
    });
  });

  describe('when the API rejects it', () => {
    beforeEach(createComponent);

    it('closes as already revoked, so the detail is read again', () => {
      submit.mockReturnValue(throwError(() => problem('already_revoked', 409)));
      type('reason');

      confirmButton().click();

      expect(dialogRef.close).toHaveBeenCalledWith('alreadyRevoked');
    });

    it.each([
      ['not_revocable', 409, 'notRevocable'],
      ['insufficient_permission', 403, 'forbidden'],
      ['invalid_token', 401, 'sessionExpired'],
      ['BAD_REQUEST', 400, 'badRequest'],
      ['status_list_unavailable', 503, 'retryLater'],
      ['rate_limited', 429, 'retryLater'],
      ['something_new', 500, 'generic'],
    ])('shows the message for %s inside the dialog and keeps it open', (type_: string, status: number, key: string) => {
      submit.mockReturnValue(throwError(() => problem(type_, status)));
      type('reason');

      confirmButton().click();
      fixture.detectChanges();

      expect(alert()?.textContent).toContain(`credentialDetails.revokeError.${key}`);
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('lets the operator fix the reason and try again', () => {
      submit.mockReturnValueOnce(throwError(() => problem('BAD_REQUEST', 400)));
      type('reason');
      confirmButton().click();
      fixture.detectChanges();

      expect(confirmButton().disabled).toBe(false);
      expect(cancelButton().disabled).toBe(false);
      expect(field().disabled).toBe(false);
      expect(dialogRef.disableClose).toBe(false);

      type('a better reason');
      confirmButton().click();
      fixture.detectChanges();

      expect(submit).toHaveBeenCalledTimes(2);
      expect(submit).toHaveBeenLastCalledWith('a better reason');
      expect(alert()).toBeNull();
      expect(dialogRef.close).toHaveBeenCalledWith('revoked');
    });

    it('keeps the reason the operator wrote', () => {
      submit.mockReturnValue(throwError(() => problem('rate_limited', 429)));
      type('my reason');

      confirmButton().click();
      fixture.detectChanges();

      expect(field().value).toBe('my reason');
    });
  });
});
