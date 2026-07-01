import { TestBed } from '@angular/core/testing';
import { CredentialOfferOnboardingComponent } from './credential-offer-onboarding.component';
import { TranslateModule } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { environment } from 'src/environments/environment';
import { ThemeService } from 'src/app/core/services/theme.service';
import { WALLET_BASE_URL } from 'src/app/core/constants/wallet.constants';

const MOCK_KNOWLEDGE_BASE_URL = 'https://knowledgebase.example.com/';

describe('CredentialOfferOnboardingComponent', () => {
  let component: CredentialOfferOnboardingComponent;

  beforeEach(async () => {
    const themeServiceMock = {
      knowledgeBaseUrl: MOCK_KNOWLEDGE_BASE_URL,
    };

    await TestBed.configureTestingModule({
      imports: [QRCodeComponent, TranslateModule.forRoot(), CredentialOfferOnboardingComponent],
      providers: [
        { provide: ThemeService, useValue: themeServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CredentialOfferOnboardingComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should derive walletUrl from the current origin (Atlassian-style)', () => {
    expect(component.walletUrl).toBe(WALLET_BASE_URL);
  });

  it('should derive walletTestUrl from the current origin (Atlassian-style)', () => {
    expect(component.walletTestUrl).toBe(WALLET_BASE_URL);
  });

  it('should get showWalletSameDeviceUrlTest', () => {
    expect(component.showWalletSameDeviceUrlTest).toBe(environment.show_wallet_url_test);
  });

  it('should initialize walletUsersGuideUrl with the correct value from theme', () => {
    const expectedGuideUrl = MOCK_KNOWLEDGE_BASE_URL + "/books/dome-digital-wallet-user-guide";
    expect(component.walletUsersGuideUrl).toBe(expectedGuideUrl);
  });

  it('should set the QR color to "#2d58a7"', () => {
    expect(component.qrColor).toBe('#2d58a7');
  });
});
