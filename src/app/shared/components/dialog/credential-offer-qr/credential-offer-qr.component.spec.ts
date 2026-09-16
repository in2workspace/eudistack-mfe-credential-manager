import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { CredentialOfferQrComponent } from './credential-offer-qr.component';
import { TenantService } from 'src/app/core/services/tenant.service';
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
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), CredentialOfferQrComponent],
      providers: [
        { provide: TenantService, useValue: mockTenantService },
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
      expect(component.copied).toBe(true);

      tick(2000);
      expect(component.copied).toBe(false);
    }));
  });
});
