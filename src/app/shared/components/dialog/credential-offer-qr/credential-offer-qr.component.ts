import { Component, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { TenantService } from 'src/app/core/services/tenant.service';
import { WALLET_CALLBACK_PATH } from 'src/app/core/constants/wallet.constants';

/**
 * The scannable credential offer: QR, copy-link button and the same-device wallet links.
 *
 * Extracted from `CredentialOfferDialogComponent` when the multi-mode result dialog started
 * needing the same block. The wallet-link derivation (which of the tenant's two wallet URLs is
 * the main one, unwrapping the https offer URL out of the `openid-credential-offer://` URI) is
 * fiddly enough that a second copy of it would drift; both dialogs now render this.
 */
@Component({
  selector: 'app-credential-offer-qr',
  imports: [MatIcon, QRCodeComponent, TranslatePipe],
  templateUrl: './credential-offer-qr.component.html',
  styleUrl: './credential-offer-qr.component.scss'
})
export class CredentialOfferQrComponent {
  public readonly credentialOfferUri = input.required<string>();

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
    return base + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(this.extractCredentialOfferHttpsUrl(this.credentialOfferUri()));
  }

  /** Environment-specific wallet link, shown alongside the main link when defaultEnv is configured. */
  public get walletEnvFullUrl(): string {
    return this.tenantService.walletUrl() + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(this.extractCredentialOfferHttpsUrl(this.credentialOfferUri()));
  }

  public copyOfferUri(): void {
    navigator.clipboard.writeText(this.credentialOfferUri());
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }

  private extractCredentialOfferHttpsUrl(oid4vciUri: string): string {
    try {
      return new URL(oid4vciUri).searchParams.get('credential_offer_uri') ?? oid4vciUri;
    } catch {
      return oid4vciUri;
    }
  }
}
