import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CredentialOfferDialogComponent, CredentialOfferDialogData } from './credential-offer-dialog.component';
import { WALLET_SAME_DEVICE_URL } from 'src/app/core/constants/wallet.constants';
import { environment } from 'src/environments/environment';

describe('CredentialOfferDialogComponent', () => {
  let component: CredentialOfferDialogComponent;
  let mockDialogRef: jest.Mocked<MatDialogRef<CredentialOfferDialogComponent>>;

  const HTTPS_OFFER_URL = 'https://example.com/offer/123';
  const WALLET_URL = 'https://wallet.tenant.es/protocol/callback';
  const mockData: CredentialOfferDialogData = {
    credentialOfferUri: `${WALLET_URL}?credential_offer_uri=${encodeURIComponent(HTTPS_OFFER_URL)}`,
  };

  beforeEach(() => {
    mockDialogRef = {
      close: jest.fn(),
    } as unknown as jest.Mocked<MatDialogRef<CredentialOfferDialogComponent>>;

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), NoopAnimationsModule],
      providers: [
        CredentialOfferDialogComponent,
        { provide: MAT_DIALOG_DATA, useValue: mockData },
        { provide: MatDialogRef, useValue: mockDialogRef },
      ],
    });

    component = TestBed.inject(CredentialOfferDialogComponent);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should set qrColor to "#000000"', () => {
    expect(component.qrColor).toBe('#000000');
  });

  it('should derive walletSameDeviceUrl from the current origin (Atlassian-style)', () => {
    expect(component.walletSameDeviceUrl).toBe(WALLET_SAME_DEVICE_URL);
  });

  it('should derive walletSameDeviceTestUrl from the current origin (Atlassian-style)', () => {
    expect(component.walletSameDeviceTestUrl).toBe(WALLET_SAME_DEVICE_URL);
  });

  it('should expose showWalletSameDeviceUrlTest from environment', () => {
    expect(component.showWalletSameDeviceUrlTest).toBe(environment.show_wallet_url_test);
  });

  describe('walletSameDeviceFullUrl', () => {
    it('should extract the inner HTTPS URL from the wallet callback URL', () => {
      const expected = WALLET_SAME_DEVICE_URL + '?credential_offer_uri=' + encodeURIComponent(HTTPS_OFFER_URL);
      expect(component.walletSameDeviceFullUrl).toBe(expected);
    });

    it('should fall back to the raw URI when credential_offer_uri param is absent', () => {
      const rawUri = 'https://wallet.tenant.es/protocol/callback?other_param=value';
      (component as any).data = { credentialOfferUri: rawUri };
      const expected = WALLET_SAME_DEVICE_URL + '?credential_offer_uri=' + encodeURIComponent(rawUri);
      expect(component.walletSameDeviceFullUrl).toBe(expected);
    });

    it('should fall back to the raw string when credentialOfferUri is not a valid URL', () => {
      const rawUri = 'not-a-valid-url';
      (component as any).data = { credentialOfferUri: rawUri };
      const expected = WALLET_SAME_DEVICE_URL + '?credential_offer_uri=' + encodeURIComponent(rawUri);
      expect(component.walletSameDeviceFullUrl).toBe(expected);
    });
  });

  describe('walletSameDeviceTestFullUrl', () => {
    it('should extract the inner HTTPS URL from the wallet callback URL', () => {
      const expected = WALLET_SAME_DEVICE_URL + '?credential_offer_uri=' + encodeURIComponent(HTTPS_OFFER_URL);
      expect(component.walletSameDeviceTestFullUrl).toBe(expected);
    });

    it('should fall back to the raw URI when credential_offer_uri param is absent', () => {
      const rawUri = 'https://wallet.tenant.es/protocol/callback?other_param=value';
      (component as any).data = { credentialOfferUri: rawUri };
      const expected = WALLET_SAME_DEVICE_URL + '?credential_offer_uri=' + encodeURIComponent(rawUri);
      expect(component.walletSameDeviceTestFullUrl).toBe(expected);
    });
  });

  describe('copyOfferUri()', () => {
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
    it('should call dialogRef.close()', () => {
      component.close();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
