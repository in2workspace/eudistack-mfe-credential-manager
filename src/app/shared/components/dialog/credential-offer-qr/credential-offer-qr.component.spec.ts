import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CredentialOfferQrComponent } from './credential-offer-qr.component';
import { TenantService } from 'src/app/core/services/tenant.service';
import { WALLET_CALLBACK_PATH } from 'src/app/core/constants/wallet.constants';

/**
 * These cases moved here with the QR block itself, out of CredentialOfferDialogComponent: the
 * wallet-link derivation they cover now lives in this component and is shared by both dialogs.
 */
describe('CredentialOfferQrComponent', () => {
  let fixture: ComponentFixture<CredentialOfferQrComponent>;
  let component: CredentialOfferQrComponent;
  let mockTenantService: { walletUrl: jest.Mock; defaultWalletUrl: jest.Mock };

  const HTTPS_OFFER_URL = 'https://example.com/offer/123';
  const ENV_WALLET_BASE = 'https://wallet.env.es';
  const DEFAULT_WALLET_BASE = 'https://wallet.main.es';
  const OFFER_URI = `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(HTTPS_OFFER_URL)}`;

  function walletCallbackUrl(base: string, offerUrl: string): string {
    return base + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(offerUrl);
  }

  function setup(walletUrl: string, defaultWalletUrl: string | null, offerUri: string = OFFER_URI) {
    mockTenantService = {
      walletUrl: jest.fn().mockReturnValue(walletUrl),
      defaultWalletUrl: jest.fn().mockReturnValue(defaultWalletUrl),
    };

    TestBed.configureTestingModule({
      imports: [CredentialOfferQrComponent, TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [{ provide: TenantService, useValue: mockTenantService }],
    });

    fixture = TestBed.createComponent(CredentialOfferQrComponent);
    fixture.componentRef.setInput('credentialOfferUri', offerUri);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.resetAllMocks();
  });

  describe('without defaultEnv (single wallet URL)', () => {
    beforeEach(() => setup(ENV_WALLET_BASE, null));

    it('should create the component', () => expect(component).toBeTruthy());

    it('showEnvWallet should be false', () => {
      expect(component.showEnvWallet).toBe(false);
    });

    it('walletMainFullUrl should use the env wallet URL', () => {
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, HTTPS_OFFER_URL));
    });
  });

  describe('with defaultEnv (dual wallet URLs)', () => {
    beforeEach(() => setup(ENV_WALLET_BASE, DEFAULT_WALLET_BASE));

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
    it('should extract the inner HTTPS URL from the wallet callback URI', () => {
      setup(ENV_WALLET_BASE, null);
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, HTTPS_OFFER_URL));
    });

    it('should fall back to the raw URI when credential_offer_uri param is absent', () => {
      const rawUri = 'https://wallet.env.es/protocol/callback?other_param=value';
      setup(ENV_WALLET_BASE, null, rawUri);
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, rawUri));
    });

    it('should fall back to the raw string when credentialOfferUri is not a valid URL', () => {
      const rawUri = 'not-a-valid-url';
      setup(ENV_WALLET_BASE, null, rawUri);
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, rawUri));
    });
  });

  describe('copyOfferUri()', () => {
    beforeEach(() => setup(ENV_WALLET_BASE, null));

    it('should write credentialOfferUri to clipboard, set copied=true, then reset after 2s', fakeAsync(() => {
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
      });

      expect(component.copied).toBe(false);
      component.copyOfferUri();

      expect(writeTextMock).toHaveBeenCalledWith(OFFER_URI);
      expect(component.copied).toBe(true);

      tick(2000);
      expect(component.copied).toBe(false);
    }));
  });
});
