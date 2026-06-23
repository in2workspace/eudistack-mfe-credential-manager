import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CredentialOfferDialogComponent, CredentialOfferDialogData } from './credential-offer-dialog.component';
import { TenantService } from 'src/app/core/services/tenant.service';
import { WALLET_CALLBACK_PATH } from 'src/app/core/constants/wallet.constants';

describe('CredentialOfferDialogComponent', () => {
  let component: CredentialOfferDialogComponent;
  let mockDialogRef: jest.Mocked<MatDialogRef<CredentialOfferDialogComponent>>;
  let mockTenantService: { walletUrl: jest.Mock; defaultWalletUrl: jest.Mock };

  const HTTPS_OFFER_URL = 'https://example.com/offer/123';
  const ENV_WALLET_BASE = 'https://wallet.env.es';
  const DEFAULT_WALLET_BASE = 'https://wallet.main.es';
  const mockData: CredentialOfferDialogData = {
    credentialOfferUri: `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(HTTPS_OFFER_URL)}`,
  };

  function walletCallbackUrl(base: string, offerUrl: string): string {
    return base + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(offerUrl);
  }

  function buildService(walletUrl: string, defaultWalletUrl: string | null) {
    mockTenantService = {
      walletUrl: jest.fn().mockReturnValue(walletUrl),
      defaultWalletUrl: jest.fn().mockReturnValue(defaultWalletUrl),
    };
  }

  function setup() {
    mockDialogRef = { close: jest.fn() } as unknown as jest.Mocked<MatDialogRef<CredentialOfferDialogComponent>>;

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        CredentialOfferDialogComponent,
        { provide: MAT_DIALOG_DATA, useValue: mockData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: TenantService, useValue: mockTenantService },
      ],
    });

    component = TestBed.inject(CredentialOfferDialogComponent);
  }

  afterEach(() => jest.resetAllMocks());

  describe('without defaultEnv (single wallet URL)', () => {
    beforeEach(() => {
      buildService(ENV_WALLET_BASE, null);
      setup();
    });

    it('should create the component', () => expect(component).toBeTruthy());

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
      setup();
    });

    it('should extract the inner HTTPS URL from the wallet callback URI', () => {
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, HTTPS_OFFER_URL));
    });

    it('should fall back to the raw URI when credential_offer_uri param is absent', () => {
      const rawUri = 'https://wallet.env.es/protocol/callback?other_param=value';
      (component as any).data = { credentialOfferUri: rawUri };
      expect(component.walletMainFullUrl).toBe(walletCallbackUrl(ENV_WALLET_BASE, rawUri));
    });

    it('should fall back to the raw string when credentialOfferUri is not a valid URL', () => {
      const rawUri = 'not-a-valid-url';
      (component as any).data = { credentialOfferUri: rawUri };
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

      expect(writeTextMock).toHaveBeenCalledWith(mockData.credentialOfferUri);
      expect(component.copied).toBe(true);

      tick(2000);
      expect(component.copied).toBe(false);
    }));
  });

  describe('close()', () => {
    beforeEach(() => {
      buildService(ENV_WALLET_BASE, null);
      setup();
    });

    it('should call dialogRef.close()', () => {
      component.close();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
