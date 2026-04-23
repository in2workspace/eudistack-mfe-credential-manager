import { TestBed } from '@angular/core/testing';
import { CredentialOfferComponent } from './credential-offer.component';
import { TranslateModule } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { NgIf } from '@angular/common';
import { environment } from 'src/environments/environment';
import { ThemeService } from 'src/app/core/services/theme.service';
import { WALLET_SAME_DEVICE_URL } from 'src/app/core/constants/wallet.constants';

const MOCK_KNOWLEDGE_BASE_URL = 'https://knowledgebase.example.com/';

describe('CredentialOfferComponent', () => {
  let component: CredentialOfferComponent;

  beforeEach(async () => {
    const themeServiceMock = {
      knowledgeBaseUrl: MOCK_KNOWLEDGE_BASE_URL,
    };

    await TestBed.configureTestingModule({
      imports: [ NgIf, QRCodeComponent, TranslateModule.forRoot(), CredentialOfferComponent],
      providers: [
        { provide: ThemeService, useValue: themeServiceMock },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CredentialOfferComponent);
    component = fixture.componentInstance;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should set the QR color to "#000000"', () => {
    expect(component.qrColor).toBe('#000000');
  });

  it('should initialize walletUsersGuideUrl with the correct value from theme', () => {
    const expectedGuideUrl = MOCK_KNOWLEDGE_BASE_URL + '/books/dome-digital-wallet-user-guide';
    expect(component.walletUsersGuideUrl).toBe(expectedGuideUrl);
  });

  it('should derive walletSameDeviceUrl from the current origin (Atlassian-style)', () => {
    expect(component.walletSameDeviceUrl).toBe(WALLET_SAME_DEVICE_URL);
  });

  it('should compute walletSameDeviceUrl$ correctly when credentialOfferUri$ is provided', () => {
    const credentialOfferUriMock = 'mockCredentialOfferUri';
    (component as any).credentialOfferUri$ = () => credentialOfferUriMock;

    const expectedComputedUrl =
      WALLET_SAME_DEVICE_URL + '?credential_offer_uri=' + encodeURIComponent(credentialOfferUriMock);

    expect(component.walletSameDeviceUrl$()).toBe(expectedComputedUrl);
  });

  it('should get showWalletSameDeviceUrlTest', () => {
    expect(component.showWalletSameDeviceUrlTest).toBe(environment.show_wallet_url_test);
  });

  it('should derive walletSameDeviceTestUrl from the current origin (Atlassian-style)', () => {
    expect(component.walletSameDeviceTestUrl).toBe(WALLET_SAME_DEVICE_URL);
  });

  it('should compute walletSameDeviceTestUrl$ correctly when credentialOfferUri$ is provided', () => {
    const credentialOfferUriMock = 'mockCredentialOfferUri';
    (component as any).credentialOfferUri$ = () => credentialOfferUriMock;

    const expectedComputedTestUrl =
      WALLET_SAME_DEVICE_URL + '?credential_offer_uri=' + encodeURIComponent(credentialOfferUriMock);

    expect(component.walletSameDeviceTestUrl$()).toBe(expectedComputedTestUrl);
  });

  it('should emit refreshCredential when onRefreshCredentialClick is called', () => {
    const eventMock = { preventDefault: jest.fn() } as unknown as Event;

    const emitSpy = jest.spyOn(component.refreshCredential, 'emit');

    component.onRefreshCredentialClick(eventMock);

    expect(eventMock.preventDefault).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalled();
  });
});
