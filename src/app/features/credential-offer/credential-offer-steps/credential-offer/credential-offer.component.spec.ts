import { TestBed } from '@angular/core/testing';
import { CredentialOfferComponent } from './credential-offer.component';
import { TranslateModule } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { NgIf } from '@angular/common';
import { ThemeService } from 'src/app/core/services/theme.service';
import { TenantService } from 'src/app/core/services/tenant.service';
import { WALLET_CALLBACK_PATH } from 'src/app/core/constants/wallet.constants';

const MOCK_KNOWLEDGE_BASE_URL = 'https://knowledgebase.example.com/';
const ENV_WALLET_BASE = 'https://wallet.env.es';
const DEFAULT_WALLET_BASE = 'https://wallet.main.es';

function walletCallbackUrl(base: string, offerUri: string): string {
  return base + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(offerUri);
}

describe('CredentialOfferComponent', () => {
  let component: CredentialOfferComponent;

  function setup(walletUrl: string, defaultWalletUrl: string | null) {
    const themeServiceMock = { knowledgeBaseUrl: MOCK_KNOWLEDGE_BASE_URL };
    const tenantServiceMock = {
      walletUrl: jest.fn().mockReturnValue(walletUrl),
      defaultWalletUrl: jest.fn().mockReturnValue(defaultWalletUrl),
    };

    TestBed.configureTestingModule({
      imports: [NgIf, QRCodeComponent, TranslateModule.forRoot(), CredentialOfferComponent],
      providers: [
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: TenantService, useValue: tenantServiceMock },
      ],
    });

    const fixture = TestBed.createComponent(CredentialOfferComponent);
    component = fixture.componentInstance;
  }

  it('should create the component', () => {
    setup(ENV_WALLET_BASE, null);
    expect(component).toBeTruthy();
  });

  it('should set the QR color to "#000000"', () => {
    setup(ENV_WALLET_BASE, null);
    expect(component.qrColor).toBe('#000000');
  });

  it('should initialize walletUsersGuideUrl with the correct value from theme', () => {
    setup(ENV_WALLET_BASE, null);
    const expectedGuideUrl = MOCK_KNOWLEDGE_BASE_URL + '/books/dome-digital-wallet-user-guide';
    expect(component.walletUsersGuideUrl).toBe(expectedGuideUrl);
  });

  describe('without defaultEnv', () => {
    beforeEach(() => setup(ENV_WALLET_BASE, null));

    it('showEnvWallet should be false', () => {
      expect(component.showEnvWallet).toBe(false);
    });

    it('walletMainUrl$ should use the env wallet URL', () => {
      const offerUri = 'mockCredentialOfferUri';
      (component as any).credentialOfferUri$ = () => offerUri;
      expect(component.walletMainUrl$()).toBe(walletCallbackUrl(ENV_WALLET_BASE, offerUri));
    });
  });

  describe('with defaultEnv', () => {
    beforeEach(() => setup(ENV_WALLET_BASE, DEFAULT_WALLET_BASE));

    it('showEnvWallet should be true', () => {
      expect(component.showEnvWallet).toBe(true);
    });

    it('walletMainUrl$ should use the defaultEnv wallet URL', () => {
      const offerUri = 'mockCredentialOfferUri';
      (component as any).credentialOfferUri$ = () => offerUri;
      expect(component.walletMainUrl$()).toBe(walletCallbackUrl(DEFAULT_WALLET_BASE, offerUri));
    });

    it('walletEnvUrl$ should use the environment wallet URL', () => {
      const offerUri = 'mockCredentialOfferUri';
      (component as any).credentialOfferUri$ = () => offerUri;
      expect(component.walletEnvUrl$()).toBe(walletCallbackUrl(ENV_WALLET_BASE, offerUri));
    });
  });

  it('should emit refreshCredential when onRefreshCredentialClick is called', () => {
    setup(ENV_WALLET_BASE, null);
    const eventMock = { preventDefault: jest.fn() } as unknown as Event;
    const emitSpy = jest.spyOn(component.refreshCredential, 'emit');
    component.onRefreshCredentialClick(eventMock);
    expect(eventMock.preventDefault).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalled();
  });
});
