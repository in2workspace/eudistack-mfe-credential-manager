import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NEVER, of, throwError } from 'rxjs';
import { CredentialProcedureService } from 'src/app/core/services/credential-procedure.service';
import { TranslateModule } from '@ngx-translate/core';
import { CredentialOfferQrComponent } from './credential-offer-qr.component';
import { TenantService } from 'src/app/core/services/tenant.service';
import { ToastService } from 'src/app/core/services/toast.service';
import { WALLET_CALLBACK_PATH } from 'src/app/core/constants/wallet.constants';

/**
 * Regression of the extraction from `CredentialOfferDialogComponent` (EUD-233 Task 19/33):
 * same assertions that spec used to make directly on the dialog, now made through this
 * component's input instead of `MAT_DIALOG_DATA`.
 */
describe('CredentialOfferQrComponent', () => {
  let fixture: ComponentFixture<CredentialOfferQrComponent>;
  let component: CredentialOfferQrComponent;
  let mockTenantService: { walletUrl: jest.Mock; defaultWalletUrl: jest.Mock };
  let mockToast: { error: jest.Mock };

  const HTTPS_OFFER_URL = 'https://example.com/offer/123';
  const ENV_WALLET_BASE = 'https://wallet.env.es';
  const DEFAULT_WALLET_BASE = 'https://wallet.main.es';
  const CREDENTIAL_OFFER_URI = `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(HTTPS_OFFER_URL)}`;

  function walletCallbackUrl(base: string, offerUrl: string): string {
    return base + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(offerUrl);
  }

  function buildService(walletUrl: string, defaultWalletUrl: string | null) {
    mockTenantService = {
      walletUrl: jest.fn().mockReturnValue(walletUrl),
      defaultWalletUrl: jest.fn().mockReturnValue(defaultWalletUrl),
    };
  }

  function setup(credentialOfferUri = CREDENTIAL_OFFER_URI) {
    mockToast = { error: jest.fn() };
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), CredentialOfferQrComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: mockTenantService },
        { provide: ToastService, useValue: mockToast },
      ],
    });

    fixture = TestBed.createComponent(CredentialOfferQrComponent);
    fixture.componentRef.setInput('credentialOfferUri', credentialOfferUri);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => jest.resetAllMocks());

  it('should create the component', () => {
    buildService(ENV_WALLET_BASE, null);
    setup();
    expect(component).toBeTruthy();
  });

  describe('without defaultEnv (single wallet URL)', () => {
    beforeEach(() => {
      buildService(ENV_WALLET_BASE, null);
      setup();
    });

    it('showEnvWallet should be false', () => {
      expect(component.showEnvWallet).toBe(false);
    });

    it('walletMainFullUrl should use the env wallet URL', () => {
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, HTTPS_OFFER_URL));
    });
  });

  describe('with defaultEnv (dual wallet URLs)', () => {
    beforeEach(() => {
      buildService(ENV_WALLET_BASE, DEFAULT_WALLET_BASE);
      setup();
    });

    it('showEnvWallet should be true', () => {
      expect(component.showEnvWallet).toBe(true);
    });

    it('walletMainFullUrl should use the defaultEnv wallet URL', () => {
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(DEFAULT_WALLET_BASE, HTTPS_OFFER_URL));
    });

    it('walletEnvFullUrl should use the environment wallet URL', () => {
      expect(component.walletEnvFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, HTTPS_OFFER_URL));
    });
  });

  describe('credential offer URI extraction', () => {
    beforeEach(() => {
      buildService(ENV_WALLET_BASE, null);
    });

    it('should extract the inner HTTPS URL from the wallet callback URI', () => {
      setup();
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, HTTPS_OFFER_URL));
    });

    it('should fall back to the raw URI when credential_offer_uri param is absent', () => {
      const rawUri = 'https://wallet.env.es/protocol/callback?other_param=value';
      setup(rawUri);
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, rawUri));
    });

    it('should fall back to the raw string when credentialOfferUri is not a valid URL', () => {
      const rawUri = 'not-a-valid-url';
      setup(rawUri);
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, rawUri));
    });
  });

  describe('copyOfferUri()', () => {
    beforeEach(() => {
      buildService(ENV_WALLET_BASE, null);
      setup();
    });

    it('should write credentialOfferUri to clipboard, set copied=true, then reset after 2s', fakeAsync(() => {
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
      });

      expect(component.copied).toBe(false);
      component.copyOfferUri();

      expect(writeTextMock).toHaveBeenCalledWith(CREDENTIAL_OFFER_URI);
      // The confirmation now waits for the write to actually resolve, so it is not yet set.
      expect(component.copied).toBe(false);

      flushMicrotasks();
      expect(component.copied).toBe(true);

      tick(2000);
      expect(component.copied).toBe(false);
    }));

    it('tells the operator instead of silently claiming the URI was copied, when the write is rejected', fakeAsync(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const writeTextMock = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
      });

      component.copyOfferUri();
      flushMicrotasks();

      expect(component.copied).toBe(false);
      // A console error is invisible to the operator: the failure must surface in the UI.
      expect(mockToast.error).toHaveBeenCalledWith('error.clipboard_copy_failed');
    }));
  });

  describe('refreshing an expired offer', () => {
    const ORIGINAL = 'openid-credential-offer://original';
    const REFRESHED = 'openid-credential-offer://refreshed';

    const withToken = (token: string | undefined) => {
      buildService(ENV_WALLET_BASE, null);
      setup(ORIGINAL);
      fixture.componentRef.setInput('credentialOfferRefreshToken', token);
      fixture.detectChanges();
    };

    it('offers no refresh control when the backend sent no token', () => {
      withToken(undefined);

      expect(component.canRefresh()).toBe(false);
      expect(fixture.nativeElement.querySelectorAll('.copy-button')).toHaveLength(1);
    });

    it('renders the refresh control once a token is present', () => {
      withToken('a-refresh-token');

      expect(component.canRefresh()).toBe(true);
      expect(fixture.nativeElement.querySelectorAll('.copy-button')).toHaveLength(2);
    });

    it('swaps the offer in place on success, leaving the QR and the links in agreement', () => {
      withToken('a-refresh-token');
      const service = TestBed.inject(CredentialProcedureService);
      jest.spyOn(service, 'refreshCredentialOfferUri').mockReturnValue(of(REFRESHED));

      component.refreshOffer();

      expect(service.refreshCredentialOfferUri).toHaveBeenCalledWith('a-refresh-token');
      expect(component.activeOfferUri()).toBe(REFRESHED);
      expect(component.refreshing()).toBe(false);
      expect(component.walletMainFullUrl).toContain(encodeURIComponent(REFRESHED));
    });

    it('keeps the current offer standing when the refresh fails', () => {
      withToken('a-refresh-token');
      const service = TestBed.inject(CredentialProcedureService);
      jest.spyOn(service, 'refreshCredentialOfferUri').mockReturnValue(throwError(() => new Error('boom')));

      component.refreshOffer();

      expect(component.refreshFailed()).toBe(true);
      expect(component.refreshing()).toBe(false);
      expect(component.activeOfferUri()).toBe(ORIGINAL);
    });

    it('ignores a second click while one refresh is still in flight', () => {
      withToken('a-refresh-token');
      const service = TestBed.inject(CredentialProcedureService);
      jest.spyOn(service, 'refreshCredentialOfferUri').mockReturnValue(NEVER);

      component.refreshOffer();
      component.refreshOffer();

      expect(service.refreshCredentialOfferUri).toHaveBeenCalledTimes(1);
    });

    it('copies the refreshed offer, not the expired one it replaced', fakeAsync(() => {
      withToken('a-refresh-token');
      const service = TestBed.inject(CredentialProcedureService);
      jest.spyOn(service, 'refreshCredentialOfferUri').mockReturnValue(of(REFRESHED));
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
      });

      component.refreshOffer();
      component.copyOfferUri();
      flushMicrotasks();

      expect(writeTextMock).toHaveBeenCalledWith(REFRESHED);
      expect(component.copied).toBe(true);
      tick(2000);
    }));
  });
});
