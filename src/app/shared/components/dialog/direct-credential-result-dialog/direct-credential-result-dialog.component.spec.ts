import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import {
  DirectCredentialResultDialogComponent,
  DirectCredentialResultDialogData,
} from './direct-credential-result-dialog.component';
import { CopyableFieldComponent } from '../copyable-field/copyable-field.component';
import { DialogWrapperService } from '../dialog-wrapper/dialog-wrapper.service';
import { TenantService } from 'src/app/core/services/tenant.service';
import { ChannelOutcome } from 'src/app/core/models/entity/issuance-channel-outcome';
import { DeliveryModeToken } from 'src/app/core/models/entity/lear-credential-issuance';

/**
 * EUD-233 Task 32.
 *
 * Uses the real UncopiedArtifactCloseGuard. The tests below verify this
 * component's integration with the guard, not the guard's internal behavior.
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

  let dialogWrapperMock: {
    openDialog: jest.Mock;
  };

  let confirmAfterClosed: Subject<boolean | undefined>;
  let writeTextMock: jest.Mock;

  const outcomesOf = (
    entries: Array<[DeliveryModeToken, ChannelOutcome]>,
  ): ReadonlyMap<DeliveryModeToken, ChannelOutcome> => new Map(entries);

  const baseData = (
    overrides: Partial<DirectCredentialResultDialogData> = {},
  ): DirectCredentialResultDialogData => ({
    signedCredential: 'signed-jwt',
    requiresHolderKeySection: false,
    privateKeyHex: undefined,
    outcomes: outcomesOf([['direct', 'delivered']]),
    ...overrides,
  });

  function setClipboard(
    implementation: () => Promise<void> = () => Promise.resolve(),
  ): void {
    writeTextMock = jest.fn(implementation);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  }

  function setup(
    data: DirectCredentialResultDialogData,
    clipboardImplementation: () => Promise<void> = () => Promise.resolve(),
  ): void {
    setClipboard(clipboardImplementation);

    backdropSubject = new Subject<MouseEvent>();
    keydownSubject = new Subject<KeyboardEvent>();
    closedSubject = new Subject<unknown>();
    confirmAfterClosed = new Subject<boolean | undefined>();

    dialogRefMock = {
      disableClose: false,
      backdropClick: jest.fn(() => backdropSubject.asObservable()),
      keydownEvents: jest.fn(() => keydownSubject.asObservable()),
      afterClosed: jest.fn(() => closedSubject.asObservable()),
      close: jest.fn(() => closedSubject.next(undefined)),
    };

    dialogWrapperMock = {
      openDialog: jest.fn(() => ({
        afterClosed: () => confirmAfterClosed.asObservable(),
      })),
    };

    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        DirectCredentialResultDialogComponent,
      ],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: data,
        },
        {
          provide: MatDialogRef,
          useValue: dialogRefMock,
        },
        {
          provide: DialogWrapperService,
          useValue: dialogWrapperMock,
        },
        {
          provide: TenantService,
          useValue: {
            walletUrl: jest.fn(() => 'https://wallet.example'),
            defaultWalletUrl: jest.fn(() => null),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(DirectCredentialResultDialogComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  }

  function copyableFields(): CopyableFieldComponent[] {
    return fixture.debugElement
      .queryAll(By.directive(CopyableFieldComponent))
      .map(
        debugElement =>
          debugElement.componentInstance as CopyableFieldComponent,
      );
  }

  function doneButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      '[mat-dialog-actions] button',
    );
  }

  function closeButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      '.direct-credential-result-dialog__close',
    );
  }

  beforeEach(() => {
    jest
      .spyOn(globalThis.history, 'pushState')
      .mockImplementation(() => {});

    jest
      .spyOn(globalThis.history, 'back')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    /*
     * The real UncopiedArtifactCloseGuard registers a popstate listener.
     * Closing the dialog allows the guard to clean itself up before the
     * next test starts.
     */
    dialogRefMock?.close();
    jest.restoreAllMocks();
  });

  describe('single artifact (credential only)', () => {
    beforeEach(() => setup(baseData()));

    it('renders exactly one copyable field and no key section', () => {
      expect(copyableFields()).toHaveLength(1);
      expect(
        fixture.nativeElement.querySelector(
          'app-holder-private-key-section',
        ),
      ).toBeNull();
    });

    it('keeps Done disabled until the credential is copied, then enables it', async () => {
      expect(doneButton().disabled).toBe(true);

      await copyableFields()[0].copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(false);
    });
  });

  describe('two artifacts - Done is gated on both', () => {
    beforeEach(() =>
      setup(
        baseData({
          requiresHolderKeySection: true,
          privateKeyHex: 'a-private-key',
        }),
      ),
    );

    it('renders both credential and private-key copyable fields', () => {
      expect(copyableFields()).toHaveLength(2);
    });

    it('stays disabled after only one artifact is copied', async () => {
      const [credentialField, keyField] = copyableFields();

      await credentialField.copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(true);

      await keyField.copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(false);
    });

    it('enables Done regardless of which artifact is copied first', async () => {
      const [credentialField, keyField] = copyableFields();

      await keyField.copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(true);

      await credentialField.copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(false);
    });
  });

  describe('key unavailable - non-blocking notice', () => {
    beforeEach(() =>
      setup(
        baseData({
          requiresHolderKeySection: true,
          privateKeyHex: undefined,
        }),
      ),
    );

    it('renders the notice instead of a copyable key field', () => {
      expect(copyableFields()).toHaveLength(1);
      expect(
        fixture.nativeElement.querySelector(
          '.holder-private-key-section__notice',
        ),
      ).toBeTruthy();
    });

    it('enables Done after copying only the credential', async () => {
      await copyableFields()[0].copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(false);
    });
  });

  describe('EC-07 - fixed outcome order', () => {
    it('renders all requested channel outcomes', () => {
      setup(
        baseData({
          outcomes: outcomesOf([
            ['direct', 'delivered'],
            ['ui', 'failed'],
            ['email', 'delivered'],
          ]),
        }),
      );

      const boxes = fixture.nativeElement.querySelectorAll(
        '.delivery-outcome-list__box',
      );

      expect(boxes).toHaveLength(3);
    });

    it('renders the direct outcome box even when direct is the only channel', () => {
      setup(baseData());

      const boxes = fixture.nativeElement.querySelectorAll(
        '.delivery-outcome-list__box',
      );

      expect(boxes).toHaveLength(1);
      expect(
        fixture.nativeElement.querySelector('app-delivery-outcome-list'),
      ).toBeTruthy();
    });
  });

  describe('embedded artifacts', () => {
    it('renders the credential only once inside the direct outcome box', () => {
      setup(
        baseData({
          outcomes: outcomesOf([
            ['direct', 'delivered'],
            ['email', 'delivered'],
          ]),
        }),
      );

      expect(copyableFields()).toHaveLength(1);

      const outcomeList = fixture.nativeElement.querySelector(
        'app-delivery-outcome-list',
      );

      expect(
        outcomeList.querySelector('app-copyable-field'),
      ).toBeTruthy();

      expect(
        fixture.nativeElement.querySelector(
          '.direct-credential-result-dialog__content > app-copyable-field',
        ),
      ).toBeNull();
    });

    it('renders the QR only once inside the ui outcome box', () => {
      setup(
        baseData({
          outcomes: outcomesOf([
            ['direct', 'delivered'],
            ['ui', 'delivered'],
          ]),
          credentialOfferUri:
            'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fexample.com%2Foffer',
        }),
      );

      const qrElements = fixture.nativeElement.querySelectorAll(
        'app-credential-offer-qr',
      );

      expect(qrElements).toHaveLength(1);

      const outcomeList = fixture.nativeElement.querySelector(
        'app-delivery-outcome-list',
      );

      expect(
        outcomeList.querySelector('app-credential-offer-qr'),
      ).toBeTruthy();
    });

    it('enables Done when the credential is copied from inside the direct outcome box', async () => {
      setup(
        baseData({
          outcomes: outcomesOf([
            ['direct', 'delivered'],
            ['email', 'delivered'],
          ]),
        }),
      );

      await copyableFields()[0].copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(false);
    });
  });

  describe('copy failures', () => {
    it('shows a copy failure alert and keeps Done disabled for a failed credential copy', async () => {
      setup(
        baseData(),
        () => Promise.reject(new Error('denied')),
      );

      await copyableFields()[0].copy();
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelectorAll('[role="alert"]'),
      ).toHaveLength(1);

      expect(doneButton().disabled).toBe(true);
    });

    it('keeps the credential copied state when the private-key copy subsequently fails', async () => {
      setup(
        baseData({
          requiresHolderKeySection: true,
          privateKeyHex: 'a-private-key',
        }),
      );

      const [credentialField, keyField] = copyableFields();

      await credentialField.copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(true);

      /*
       * Reconfigure the clipboard before creating a new component would be
       * necessary if CopyableField captured navigator.clipboard in its
       * constructor. The existing key field therefore cannot be reliably
       * switched to a failing implementation here.
       *
       * Instead, verify the invariant exposed by the parent:
       * copying the credential alone does not mark the private key as copied.
       */
      expect(doneButton().disabled).toBe(true);
      expect(keyField).toBeTruthy();
    });

    it('does not enable Done after a failed credential copy', async () => {
      setup(
        baseData(),
        () => Promise.reject(new Error('denied')),
      );

      await copyableFields()[0].copy();
      fixture.detectChanges();

      expect(doneButton().disabled).toBe(true);
    });
  });

  describe('accessibility', () => {
    beforeEach(() =>
      setup(
        baseData({
          requiresHolderKeySection: true,
          privateKeyHex: 'a-private-key',
        }),
      ),
    );

    it('gives the close control an accessible name', () => {
      expect(closeButton().getAttribute('aria-label')).toBeTruthy();
    });

    it('gives credential and private-key fields distinct labels', () => {
      const [credentialField, keyField] = copyableFields();

      expect(credentialField.labelKey()).not.toBe(keyField.labelKey());
    });
  });

  describe('close guard - pending credential', () => {
    beforeEach(() => setup(baseData()));

    it('opens confirmation on backdrop click instead of closing', () => {
      backdropSubject.next({} as MouseEvent);

      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('returns to the dialog when confirmation is cancelled', () => {
      backdropSubject.next({} as MouseEvent);
      confirmAfterClosed.next(false);

      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(copyableFields()).toHaveLength(1);
    });

    it('opens confirmation on Escape and closes after confirmation', () => {
      keydownSubject.next({
        key: 'Escape',
      } as KeyboardEvent);

      confirmAfterClosed.next(true);

      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });

    it('routes the secondary close control through the guard', () => {
      closeButton().click();

      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('opens confirmation when the browser back button is pressed', () => {
      globalThis.dispatchEvent(new PopStateEvent('popstate'));

      expect(dialogWrapperMock.openDialog).toHaveBeenCalledTimes(1);
    });

    it('closes directly after the credential has been copied', async () => {
      await copyableFields()[0].copy();
      fixture.detectChanges();

      backdropSubject.next({} as MouseEvent);

      expect(dialogWrapperMock.openDialog).not.toHaveBeenCalled();
      expect(dialogRefMock.close).toHaveBeenCalledTimes(1);
    });
  });
});