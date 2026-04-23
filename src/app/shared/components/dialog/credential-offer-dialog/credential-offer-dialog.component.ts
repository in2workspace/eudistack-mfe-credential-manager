import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { environment } from 'src/environments/environment';
import { WALLET_SAME_DEVICE_URL } from 'src/app/core/constants/wallet.constants';

export interface CredentialOfferDialogData {
  credentialOfferUri: string;
}

@Component({
    selector: 'app-credential-offer-dialog',
    imports: [
        MatButton,
        MatDialogTitle,
        MatDialogContent,
        MatDialogActions,
        MatIcon,
        QRCodeComponent,
        TranslatePipe,
    ],
    templateUrl: './credential-offer-dialog.component.html',
    styleUrl: './credential-offer-dialog.component.scss'
})
export class CredentialOfferDialogComponent {
  public readonly data = inject<CredentialOfferDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CredentialOfferDialogComponent>);

  public copied = false;
  public readonly qrColor = '#000000';

  public readonly walletSameDeviceUrl = WALLET_SAME_DEVICE_URL;
  public readonly showWalletSameDeviceUrlTest = environment.show_wallet_url_test;
  public readonly walletSameDeviceTestUrl = WALLET_SAME_DEVICE_URL;

  public get walletSameDeviceFullUrl(): string {
    const httpsUrl = this.extractCredentialOfferHttpsUrl(this.data.credentialOfferUri);
    return this.walletSameDeviceUrl + '?credential_offer_uri=' + encodeURIComponent(httpsUrl);
  }

  public get walletSameDeviceTestFullUrl(): string {
    const httpsUrl = this.extractCredentialOfferHttpsUrl(this.data.credentialOfferUri);
    return this.walletSameDeviceTestUrl + '?credential_offer_uri=' + encodeURIComponent(httpsUrl);
  }

  /**
   * Extracts the HTTPS credential offer URL from the openid-credential-offer:// URI.
   * Input:  openid-credential-offer://?credential_offer_uri=https%3A%2F%2F...
   * Output: https://...
   */
  private extractCredentialOfferHttpsUrl(oid4vciUri: string): string {
    try {
      const parsed = new URL(oid4vciUri.replace('openid-credential-offer://', 'https://openid-credential-offer/'));
      const innerUrl = parsed.searchParams.get('credential_offer_uri');
      return innerUrl ?? oid4vciUri;
    } catch {
      return oid4vciUri;
    }
  }

  public copyOfferUri(): void {
    navigator.clipboard.writeText(this.data.credentialOfferUri);
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }

  public close(): void {
    this.dialogRef.close();
  }
}