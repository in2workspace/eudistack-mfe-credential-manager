import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
import { CredentialOfferDialogComponent, CredentialOfferDialogData } from './credential-offer-dialog.component';
import { CredentialOfferQrComponent } from '../credential-offer-qr/credential-offer-qr.component';
import { CopyableFieldComponent } from '../copyable-field/copyable-field.component';
import { DialogWrapperService } from '../dialog-wrapper/dialog-wrapper.service';
import { TenantService } from 'src/app/core/services/tenant.service';

/**
 * EUD-233 Task 19: the wallet-link derivation and copy-to-clipboard behavior this spec used to
 * assert directly now live in CredentialOfferQrComponent (own regression spec, Task 33).
 *
 * Task 37 extends this file rather than duplicating a new spec: this component IS the solo-Wallet
 * post-emission surface AD-8/AC-13 describes, extended in place (Task 24) -- the canonical asset
 * for AC-13, AC-10.2, EC-09.x, EC-11, EC-12, ES-07.2 and part of AC-14, per `acceptance-criteria.md`.
 */
describe('CredentialOfferDialogComponent', () => {
  let fixture: ComponentFixture<CredentialOfferDialogComponent>;
  let component: CredentialOfferDialogComponent;
  let mockDialogRef: {
    close: jest.Mock;
    disableClose?: boolean;
    backdropClick: jest.Mock;
    keydownEvents: jest.Mock;
    afterClosed: jest.Mock;
  };
  let backdropSubject: Subject<MouseEvent>;
  let keydownSubject: Subject<KeyboardEvent>;
  let closedSubject: Subject<unknown>;
  let dialogWrapperMock: { openDialog: jest.Mock };
  let confirmAfterClosed: Subject<boolean | undefined>;

  const mockData: CredentialOfferDialogData = {
    credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fexample.com%2Foffer%2F123',
    outcomes: new Map([['ui', 'delivered']]),
  };

  function setup(data: CredentialOfferDialogData) {
    backdropSubject = new Subject<MouseEvent>();
    keydownSubject = new Subject<KeyboardEvent>();
    closedSubject = new Subject<unknown>();
    mockDialogRef = {
      close: jest.fn(() => closedSubject.next(undefined)),
      backdropClick: jest.fn(() => backdropSubject.asObservable()),
      keydownEvents: jest.fn(() => keydownSubject.asObservable()),
      afterClosed: jest.fn(() => closedSubject.asObservable()),
    };
    confirmAfterClosed = new Subject<boolean | undefined>();
    dialogWrapperMock = { openDialog: jest.fn(() => ({ afterClosed: () => confirmAfterClosed.asObservable() })) };

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), NoopAnimationsModule, CredentialOfferDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: DialogWrapperService, useValue: dialogWrapperMock },
        { provide: TenantService, useValue: { walletUrl: jest.fn().mockReturnValue('https://wallet.env.es'), defaultWalletUrl: jest.fn().mockReturnValue(null) } },
      ],
    });

    fixture = TestBed.createComponent(CredentialOfferDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function keySectionEl(): HTMLElement | null {
    return fixture.nativeElement.querySelector('app-holder-private-key-section');
  }

  function closeButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.credential-offer-dialog__close');
  }

  function actionButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[mat-dialog-actions] button');
  }

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: jest.fn(() => Promise.resolve()) }, configurable: true });
    jest.spyOn(globalThis.history, 'pushState').mockImplementation(() => {});
    jest.spyOn(globalThis.history, 'back').mockImplementation(() => {});
  });

  afterEach(() => {
    // Same hygiene concern as uncopied-artifact-close-guard.spec.ts / the direct-result-dialog
    // spec: a guarded surface installs a real 'popstate' listener that must be retired.
    mockDialogRef?.close();
    jest.restoreAllMocks();
  });

  describe('regression: no key section (AC-05.1/AC-05.2, AS-IS)', () => {
    beforeEach(() => setup(mockData));

    it('should create the component', () => expect(component).toBeTruthy());

    it('passes its data through to CredentialOfferQrComponent unchanged', () => {
      const qr = fixture.debugElement.query(sel => sel.componentInstance instanceof CredentialOfferQrComponent);
      expect(qr).toBeTruthy();
      expect(qr.componentInstance.credentialOfferUri()).toBe(mockData.credentialOfferUri);
    });

    it('renders no key section and the single AS-IS "Close" action', () => {
      expect(keySectionEl()).toBeNull();
      expect(actionButton().disabled).toBe(false);
    });

    it('close() calls dialogRef.close() directly, no guard involved', () => {
      component.close();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it('never installs the close guard: backdrop/Esc do not open a confirmation', () => {
      backdropSubject.next({} as MouseEvent);
      keydownSubject.next({ key: 'Escape' } as KeyboardEvent);

      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
    });
  });

  describe('AC-13/EC-12: key section for the two AD-8 exempt types, wallet-only path', () => {
    beforeEach(() => setup({
      ...mockData,
      requiresHolderKeySection: true,
      privateKeyHex: 'a-private-key',
    }));

    it('renders the key section above the AS-IS Wallet content, in one view (focus order, AC-06)', () => {
      const keySection = keySectionEl();
      const qr = fixture.nativeElement.querySelector('app-credential-offer-qr');
      expect(keySection).toBeTruthy();
      expect(qr).toBeTruthy();
      // DOM order = focus order: the key section must precede the Wallet content, never a step
      // before it (AC-13's explicit "not a separate screen").
      const position = keySection!.compareDocumentPosition(qr!);
      // eslint-disable-next-line no-bitwise
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('EC-12: the Wallet content underneath stays visible and usable while the key is pending', () => {
      expect(fixture.nativeElement.querySelector('app-credential-offer-qr')).toBeTruthy();
      expect(actionButton().disabled).toBe(true); // gated on the key, not hiding anything below
    });

    it('gates "Done" on copying the key, then enables it', async () => {
      expect(actionButton().disabled).toBe(true);

      const field = fixture.debugElement.query(By.directive(CopyableFieldComponent)).componentInstance as CopyableFieldComponent;
      await field.copy();
      fixture.detectChanges();

      expect(actionButton().disabled).toBe(false);
    });

    it('ES-07.2: a failed key copy is announced and keeps "Done" disabled', async () => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: jest.fn(() => Promise.reject(new Error('denied'))) }, configurable: true });

      const field = fixture.debugElement.query(By.directive(CopyableFieldComponent)).componentInstance as CopyableFieldComponent;
      await field.copy();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('[role="alert"]').length).toBe(1);
      expect(actionButton().disabled).toBe(true);
    });
  });

  describe('AC-10.2: key unavailable in the wallet-only path -- no gating, no guard at all', () => {
    beforeEach(() => setup({
      ...mockData,
      requiresHolderKeySection: true,
      privateKeyHex: undefined,
    }));

    it('renders the non-blocking notice instead of a copyable field', () => {
      expect(fixture.nativeElement.querySelector('.holder-private-key-section__notice')).toBeTruthy();
      expect(fixture.debugElement.query(By.directive(CopyableFieldComponent))).toBeNull();
    });

    it('leaves "Done" enabled from the start: nothing to gate on', () => {
      expect(actionButton().disabled).toBe(false);
    });

    it('never opens the close guard on any discard path (no artifact pending)', () => {
      backdropSubject.next({} as MouseEvent);
      keydownSubject.next({ key: 'Escape' } as KeyboardEvent);
      closeButton()!.click();
      globalThis.dispatchEvent(new PopStateEvent('popstate'));

      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
      // Every one of those closed the dialog directly instead (AC-14.3 negative).
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });

  describe('EC-09.1: the declared Wallet channel fails, but the key section still shows (credential exists)', () => {
    beforeEach(() => setup({
      credentialOfferUri: undefined,
      requiresHolderKeySection: true,
      privateKeyHex: 'a-private-key',
      outcomes: new Map([['email', 'failed']]),
    }));

    it('renders the key section and the failed-channel outcome below it, no credential block anywhere', () => {
      expect(keySectionEl()).toBeTruthy();
      expect(fixture.nativeElement.querySelector('.delivery-outcome-list__box')).toBeTruthy();
      expect(fixture.nativeElement.textContent).not.toContain('direct-result-dialog.credentialLabel');
    });

    it('reuses the generic create-success-dialog copy when there is no QR to show', () => {
      expect(fixture.nativeElement.querySelector('app-credential-offer-qr')).toBeNull();
      // TranslateModule.forRoot() with no loader renders the untranslated key -- good enough to
      // assert which copy was picked without reaching into the component's protected members.
      expect(fixture.nativeElement.querySelector('h2').textContent).toContain('create-success-dialog.title');
    });
  });

  describe('EC-11: mutual exclusivity is structural (this host never renders a credential block)', () => {
    it('has no signedCredential-shaped content regardless of data shape', () => {
      setup({ ...mockData, requiresHolderKeySection: true, privateKeyHex: 'a-private-key' });

      const fields = fixture.debugElement.queryAll(By.directive(CopyableFieldComponent))
        .map(debugEl => (debugEl.componentInstance as CopyableFieldComponent).labelKey());
      // The only artifact this host ever tracks is the key (AD-8): there is no second, credential-shaped field.
      expect(fields).toEqual(['credentialIssuance.holderPrivateKey.label']);
    });
  });

  describe('AC-14 over this host (key section present)', () => {
    beforeEach(() => setup({
      ...mockData,
      requiresHolderKeySection: true,
      privateKeyHex: 'a-private-key',
    }));

    it('AC-14.1: backdrop opens the confirmation instead of closing', () => {
      backdropSubject.next({} as MouseEvent);
      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('AC-14.2: cancelling leaves the surface open with the key still copyable', () => {
      backdropSubject.next({} as MouseEvent);
      confirmAfterClosed.next(false);

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(keySectionEl()).toBeTruthy();
    });

    it('EC-04: the header "X" goes through the guard', () => {
      closeButton()!.click();
      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
    });

    it('the browser back button opens the confirmation too (R-15)', () => {
      globalThis.dispatchEvent(new PopStateEvent('popstate'));
      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
    });

    it('AC-14.3 negative: once the key is copied, discarding closes directly', async () => {
      const field = fixture.debugElement.query(By.directive(CopyableFieldComponent)).componentInstance as CopyableFieldComponent;
      await field.copy();
      fixture.detectChanges();

      backdropSubject.next({} as MouseEvent);

      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
    });
  });
});
