import { TestBed } from '@angular/core/testing';
import { CredentialOfferOnboardingComponent } from './credential-offer-onboarding.component';
import { TranslateModule } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { ThemeService } from 'src/app/core/services/theme.service';
import { TenantService } from 'src/app/core/services/tenant.service';

const MOCK_KNOWLEDGE_BASE_URL = 'https://knowledgebase.example.com/';
const ENV_WALLET_URL = 'https://wallet.env.es';
const DEFAULT_WALLET_URL = 'https://wallet.main.es';

describe('CredentialOfferOnboardingComponent', () => {
  let component: CredentialOfferOnboardingComponent;

  function setup(walletUrl: string, defaultWalletUrl: string | null) {
    const themeServiceMock = { knowledgeBaseUrl: MOCK_KNOWLEDGE_BASE_URL };
    const tenantServiceMock = {
      walletUrl: jest.fn().mockReturnValue(walletUrl),
      defaultWalletUrl: jest.fn().mockReturnValue(defaultWalletUrl),
    };

    TestBed.configureTestingModule({
      imports: [QRCodeComponent, TranslateModule.forRoot(), CredentialOfferOnboardingComponent],
      providers: [
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: TenantService, useValue: tenantServiceMock },
      ],
    });

    const fixture = TestBed.createComponent(CredentialOfferOnboardingComponent);
    component = fixture.componentInstance;
  }

  it('should create the component', () => {
    setup(ENV_WALLET_URL, null);
    expect(component).toBeTruthy();
  });

  it('should set the QR color to "#2d58a7"', () => {
    setup(ENV_WALLET_URL, null);
    expect(component.qrColor).toBe('#2d58a7');
  });

  it('should initialize walletUsersGuideUrl with the correct value from theme', () => {
    setup(ENV_WALLET_URL, null);
    const expectedGuideUrl = MOCK_KNOWLEDGE_BASE_URL + "/books/dome-digital-wallet-user-guide";
    expect(component.walletUsersGuideUrl).toBe(expectedGuideUrl);
  });

  describe('without defaultEnv', () => {
    beforeEach(() => setup(ENV_WALLET_URL, null));

    it('showEnvWallet should be false', () => {
      expect(component.showEnvWallet).toBe(false);
    });

    it('walletUrl should return the env wallet URL', () => {
      expect(component.walletUrl).toBe(ENV_WALLET_URL);
    });
  });

  describe('with defaultEnv', () => {
    beforeEach(() => setup(ENV_WALLET_URL, DEFAULT_WALLET_URL));

    it('showEnvWallet should be true', () => {
      expect(component.showEnvWallet).toBe(true);
    });

    it('walletUrl should return the defaultEnv wallet URL', () => {
      expect(component.walletUrl).toBe(DEFAULT_WALLET_URL);
    });

    it('walletEnvUrl should return the environment wallet URL', () => {
      expect(component.walletEnvUrl).toBe(ENV_WALLET_URL);
    });
  });
});
