import { TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CredentialOfferDialogComponent, CredentialOfferDialogData } from './credential-offer-dialog.component';

/**
 * The wallet-link and copy behaviour this dialog used to own now lives in
 * CredentialOfferQrComponent, and is covered by that component's spec. What is left here is the
 * dialog shell.
 */
describe('CredentialOfferDialogComponent', () => {
  let component: CredentialOfferDialogComponent;
  let mockDialogRef: jest.Mocked<MatDialogRef<CredentialOfferDialogComponent>>;

  const mockData: CredentialOfferDialogData = {
    credentialOfferUri: 'openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fexample.com%2Foffer%2F123',
  };

  beforeEach(() => {
    mockDialogRef = { close: jest.fn() } as unknown as jest.Mocked<MatDialogRef<CredentialOfferDialogComponent>>;

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

  afterEach(() => jest.resetAllMocks());

  it('should create the component', () => expect(component).toBeTruthy());

  it('should expose the injected credential offer URI', () => {
    expect(component.data.credentialOfferUri).toBe(mockData.credentialOfferUri);
  });

  it('close() should call dialogRef.close()', () => {
    component.close();
    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});
