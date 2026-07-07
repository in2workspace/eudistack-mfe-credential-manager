import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { TenantService } from 'src/app/core/services/tenant.service';
import { WALLET_CALLBACK_PATH } from 'src/app/core/constants/wallet.constants';

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
  private readonly tenantService = inject(TenantService);

  public copied = false;
  public readonly qrColor = '#000000';

  /** True when the tenant has a defaultEnv configured — shows both main and environment wallet links. */
  public get showEnvWallet(): boolean {
    return this.tenantService.defaultWalletUrl() !== null;
  }

  /** Main wallet link: from defaultEnv when configured, otherwise the environment wallet. */
  public get walletMainFullUrl(): string {
    const base = this.tenantService.defaultWalletUrl() ?? this.tenantService.walletUrl();
    return base + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(this.extractCredentialOfferHttpsUrl(this.data.credentialOfferUri));
  }

  /** Environment-specific wallet link, shown alongside the main link when defaultEnv is configured. */
  public get walletEnvFullUrl(): string {
    return this.tenantService.walletUrl() + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(this.extractCredentialOfferHttpsUrl(this.data.credentialOfferUri));
  }

  private extractCredentialOfferHttpsUrl(oid4vciUri: string): string {
    try {
      return new URL(oid4vciUri).searchParams.get('credential_offer_uri') ?? oid4vciUri;
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
