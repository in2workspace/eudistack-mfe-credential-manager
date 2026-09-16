import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CredentialOfferDialogComponent, CredentialOfferDialogData } from './credential-offer-dialog.component';
import { CredentialOfferQrComponent } from '../credential-offer-qr/credential-offer-qr.component';
import { TenantService } from 'src/app/core/services/tenant.service';

/**
 * EUD-233 Task 19: the wallet-link derivation and copy-to-clipboard behavior this spec used to
 * assert directly now live in CredentialOfferQrComponent (own regression spec, Task 33). This
 * dialog is left with exactly what it still owns: closing itself, and handing its data down to
 * the QR component unchanged.
 */
describe('CredentialOfferDialogComponent', () => {
  let fixture: ComponentFixture<CredentialOfferDialogComponent>;
  let component: CredentialOfferDialogComponent;
  let mockDialogRef: jest.Mocked<MatDialogRef<CredentialOfferDialogComponent>>;

  const mockData: CredentialOfferDialogData = {
    credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fexample.com%2Foffer%2F123',
    outcomes: new Map([['ui', 'delivered']]),
  };

  beforeEach(() => {
    mockDialogRef = { close: jest.fn() } as unknown as jest.Mocked<MatDialogRef<CredentialOfferDialogComponent>>;

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot(), NoopAnimationsModule, CredentialOfferDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: TenantService, useValue: { walletUrl: jest.fn().mockReturnValue('https://wallet.env.es'), defaultWalletUrl: jest.fn().mockReturnValue(null) } },
      ],
    });

    fixture = TestBed.createComponent(CredentialOfferDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => expect(component).toBeTruthy());

  it('passes its data through to CredentialOfferQrComponent unchanged', () => {
    const qr = fixture.debugElement.query(sel => sel.componentInstance instanceof CredentialOfferQrComponent);
    expect(qr).toBeTruthy();
    expect(qr.componentInstance.credentialOfferUri()).toBe(mockData.credentialOfferUri);
  });

  describe('close()', () => {
    it('should call dialogRef.close()', () => {
      component.close();
      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
