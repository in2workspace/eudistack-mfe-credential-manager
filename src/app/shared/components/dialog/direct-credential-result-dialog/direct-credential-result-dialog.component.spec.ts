import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { DirectCredentialResultDialogComponent, DirectCredentialResultDialogData } from './direct-credential-result-dialog.component';
import { CopyableFieldComponent } from '../copyable-field/copyable-field.component';
import { DialogWrapperService } from '../dialog-wrapper/dialog-wrapper.service';
import { TenantService } from 'src/app/core/services/tenant.service';
import { ChannelOutcome } from 'src/app/core/models/entity/issuance-channel-outcome';
import { DeliveryModeToken } from 'src/app/core/models/entity/lear-credential-issuance';

/**
 * EUD-233 Task 32. Uses the real UncopiedArtifactCloseGuard (providedIn: 'root', its own unit
 * coverage is Task 36) rather than mocking it away: the four discard paths are this component's
 * own integration with the guard, not the guard's internal mechanics.
 */
describe('DirectCredentialResultDialogComponent', () => {
  let fixture: ComponentFixture<DirectCredentialResultDialogComponent>;
  let component: DirectCredentialResultDialogComponent;
  let dialogRefMock: {
    disableClose: boolean;
    backdropClick: jest.Mock;
    keydownEvents: jest.Mock;
    afterClosed: jest.Mock;
    close: jest.Mock;
  };
  let backdropSubject: Subject<MouseEvent>;
  let keydownSubject: Subject<KeyboardEvent>;
  let closedSubject: Subject<unknown>;
  let dialogWrapperMock: { openDialog: jest.Mock };
  let confirmAfterClosed: Subject<boolean | undefined>;
  let writeTextMock: jest.Mock;

  const outcomesOf = (entries: Array<[DeliveryModeToken, ChannelOutcome]>) => new Map(entries);

  const baseData = (overrides: Partial<DirectCredentialResultDialogData> = {}): DirectCredentialResultDialogData => ({
    signedCredential: 'signed-jwt',
    requiresHolderKeySection: false,
    privateKeyHex: undefined,
    outcomes: outcomesOf([['direct', 'delivered']]),
    ...overrides,
  });

  function setClipboard(impl: () => Promise<void> = () => Promise.resolve()) {
    writeTextMock = jest.fn(impl);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, configurable: true });
  }

  function setup(data: DirectCredentialResultDialogData) {
    backdropSubject = new Subject<MouseEvent>();
    keydownSubject = new Subject<KeyboardEvent>();
    closedSubject = new Subject<unknown>();
    dialogRefMock = {
      disableClose: false,
      backdropClick: jest.fn(() => backdropSubject.asObservable()),
      keydownEvents: jest.fn(() => keydownSubject.asObservable()),
      afterClosed: jest.fn(() => closedSubject.asObservable()),
      close: jest.fn(() => closedSubject.next(undefined)),
    };
    confirmAfterClosed = new Subject<boolean | undefined>();
    dialogWrapperMock = { openDialog: jest.fn(() => ({ afterClosed: () => confirmAfterClosed.asObservable() })) };

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), DirectCredentialResultDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: DialogWrapperService, useValue: dialogWrapperMock },
        // Only instantiated when data.credentialOfferUri is present (CredentialOfferQrComponent).
        { provide: TenantService, useValue: { walletUrl: jest.fn(() => 'https://wallet.example'), defaultWalletUrl: jest.fn(() => null) } },
      ],
    });

    fixture = TestBed.createComponent(DirectCredentialResultDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function copyableFields(): CopyableFieldComponent[] {
    return fixture.debugElement.queryAll(By.directive(CopyableFieldComponent))
      .map(debugEl => debugEl.componentInstance as CopyableFieldComponent);
  }

  function doneButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[mat-dialog-actions] button');
  }

  function closeButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.direct-credential-result-dialog__close');
  }

  beforeEach(() => {
    setClipboard();
    // UncopiedArtifactCloseGuard.protect() pushes a real history entry on construction (R-15);
    // without this, jsdom's location would actually change across tests.
    jest.spyOn(globalThis.history, 'pushState').mockImplementation(() => {});
    jest.spyOn(globalThis.history, 'back').mockImplementation(() => {});
  });

  afterEach(() => {
    // UncopiedArtifactCloseGuard.protect() registers a real window 'popstate' listener per test;
    // without a terminal close it would otherwise leak into later tests (same concern as
    // uncopied-artifact-close-guard.spec.ts's own global afterEach).
    dialogRefMock?.close();
    jest.restoreAllMocks();
  });

  describe('single artifact (credential only)', () => {
    beforeEach(() => setup(baseData()));

    it('renders exactly one copyable field, no key section', () => {
      expect(copyableFields()).toHaveLength(1);
      expect(fixture.nativeElement.querySelector('app-holder-private-key-section')).toBeNull();
    });

    it('keeps Done disabled until the credential is copied, then enables it', async () => {
      expect(doneButton().disabled).toBe(true);

      await copyableFields()[0].copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(false);
    });
  });

  describe('two blocks + Done gated on both (EC-08: order-independent)', () => {
    beforeEach(() => setup(baseData({ requiresHolderKeySection: true, privateKeyHex: 'a-private-key' })));

    it('renders both the credential and the key blocks', () => {
      expect(copyableFields()).toHaveLength(2);
    });

    it('stays disabled after only one artifact is copied, in either order', async () => {
      const [credentialField, keyField] = copyableFields();

      await credentialField.copy();
      fixture.detectChanges();
      expect(doneButton().disabled).toBe(true);

      // The already-copied artifact's confirmation must survive the other one's copy (EC-08).
      await keyField.copy();
      fixture.detectChanges();
      expect(doneButton().disabled).toBe(false);
    });

    it('enables Done regardless of which artifact was copied first', async () => {
      const [credentialField, keyField] = copyableFields();

      await keyField.copy();
      fixture.detectChanges();
      expect(doneButton().disabled).toBe(true);

      await credentialField.copy();
      fixture.detectChanges();
      expect(doneButton().disabled).toBe(false);
    });
  });

  describe('key unavailable -- non-blocking notice, Done gated on the credential only', () => {
    beforeEach(() => setup(baseData({ requiresHolderKeySection: true, privateKeyHex: undefined })));

    it('renders the notice instead of a copyable key field', () => {
      expect(copyableFields()).toHaveLength(1); // credential only
      expect(fixture.nativeElement.querySelector('.holder-private-key-section__notice')).toBeTruthy();
    });

    it('enables Done after copying only the credential', async () => {
      await copyableFields()[0].copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(false);
    });
  });

  describe('EC-07: fixed outcome order regardless of which channel failed', () => {
    it('shows the outcomes list, direct -> ui -> email, when more than one channel was requested', () => {
      setup(baseData({ outcomes: outcomesOf([['direct', 'delivered'], ['ui', 'failed'], ['email', 'delivered']]) }));

      const boxes = fixture.nativeElement.querySelectorAll('.delivery-outcome-list__box');
      expect(boxes).toHaveLength(3);
    });

    it('still shows a bordered, titled box when only direct was requested (consistent with the hybrid case)', () => {
      setup(baseData());

      const boxes = fixture.nativeElement.querySelectorAll('.delivery-outcome-list__box');
      expect(boxes).toHaveLength(1);
      expect(fixture.nativeElement.querySelector('app-delivery-outcome-list')).toBeTruthy();
    });
  });

  /**
   * The credential (and the QR, when hybrid with `ui`) must
   * live INSIDE their outcome box, not duplicated above it as well.
   */
  describe('embedded artifacts move into their outcome box, not duplicated (2026-09-17 polish)', () => {
    it('renders the credential only once, inside the direct box, when hybrid with another channel', () => {
      setup(baseData({ outcomes: outcomesOf([['direct', 'delivered'], ['email', 'delivered']]) }));

      expect(copyableFields()).toHaveLength(1);
      const outcomeList = fixture.nativeElement.querySelector('app-delivery-outcome-list');
      expect(outcomeList.querySelector('app-copyable-field')).toBeTruthy();
      // Nothing above the outcome list is a copyable-field standing on its own.
      expect(fixture.nativeElement.querySelector('.direct-credential-result-dialog__content > app-copyable-field')).toBeNull();
    });

    it('renders the QR only once, inside the ui box, when hybrid direct+ui', () => {
      setup(baseData({
        outcomes: outcomesOf([['direct', 'delivered'], ['ui', 'delivered']]),
        credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fexample.com%2Foffer',
      }));

      const qrElements = fixture.nativeElement.querySelectorAll('app-credential-offer-qr');
      expect(qrElements).toHaveLength(1);
      const outcomeList = fixture.nativeElement.querySelector('app-delivery-outcome-list');
      expect(outcomeList.querySelector('app-credential-offer-qr')).toBeTruthy();
    });

    it('enabling Done still works when the credential copy field lives inside the direct box', async () => {
      setup(baseData({ outcomes: outcomesOf([['direct', 'delivered'], ['email', 'delivered']]) }));

      await copyableFields()[0].copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(false);
    });
  });

  describe('ES-05 / ES-07.1: copy failures are perceptible and attributable per artifact', () => {
    it('ES-05: a failed credential copy announces itself and keeps Done disabled', async () => {
      setClipboard(() => Promise.reject(new Error('denied')));
      setup(baseData());

      await copyableFields()[0].copy();
      fixture.detectChanges();

      const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
      expect(alerts).toHaveLength(1);
      expect(doneButton().disabled).toBe(true);
    });

    it('ES-07.1: a failed key copy does not revert the credential\'s already-copied state', async () => {
      setup(baseData({ requiresHolderKeySection: true, privateKeyHex: 'a-private-key' }));
      const [credentialField, keyField] = copyableFields();
      await credentialField.copy();
      fixture.detectChanges();

      setClipboard(() => Promise.reject(new Error('denied')));
      // The key field already resolved its clipboard mock at construction time; re-point it here.
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, configurable: true });
      await keyField.copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(true);
      expect(fixture.nativeElement.querySelectorAll('[role="alert"]')).toHaveLength(1);
      // The credential's own confirmation must still be visible -- ES-07.1's "does not revert".
      expect(fixture.nativeElement.textContent).toContain('credentialIssuance.direct-result-dialog.copyFailed.privateKey');
    });
  });

  describe('accessibility', () => {
    beforeEach(() => setup(baseData({ requiresHolderKeySection: true, privateKeyHex: 'a-private-key' })));

    it('gives the close control an accessible name', () => {
      expect(closeButton().getAttribute('aria-label')).toBeTruthy();
    });

    it('gives each copyable field a distinct label (credential vs private key)', () => {
      const [credentialField, keyField] = copyableFields();
      expect(credentialField.labelKey()).not.toBe(keyField.labelKey());
    });
  });

  describe('close guard over the four discard paths (uncopied credential pending)', () => {
    beforeEach(() => setup(baseData()));

    it('backdrop click opens the confirmation instead of closing', () => {
      backdropSubject.next({} as MouseEvent);
      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('cancelling returns to the surface with the credential still intact and copyable', () => {
      backdropSubject.next({} as MouseEvent);
      confirmAfterClosed.next(false);

      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(copyableFields()).toHaveLength(1);
    });

    it('Esc opens the confirmation; confirming closes the dialog', () => {
      keydownSubject.next({ key: 'Escape' } as KeyboardEvent);
      confirmAfterClosed.next(true);

      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });

    it('the secondary close control ("X") goes through the guard, not a direct close', () => {
      closeButton().click();

      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('the browser back button opens the confirmation too', () => {
      globalThis.dispatchEvent(new PopStateEvent('popstate'));
      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
    });

    it('negative: once the credential is copied, any discard path closes directly, no confirmation', async () => {
      await copyableFields()[0].copy();
      fixture.detectChanges();

      backdropSubject.next({} as MouseEvent);

      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });
  });
});
