import { Component, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { TenantService } from 'src/app/core/services/tenant.service';
import { WALLET_CALLBACK_PATH } from 'src/app/core/constants/wallet.constants';

/**
 * The scannable credential offer: QR, copy-link button and the same-device wallet links
 * (EUD-233 AD-8/AD-10, ported from `feat/direct-delivery`).
 *
 * Extracted from `CredentialOfferDialogComponent` (no behavior change) so the direct-result modal
 * (Task 22) can embed the same block without duplicating the wallet-link derivation -- which of
 * the tenant's two wallet URLs is the main one, unwrapping the https offer URL out of the
 * `openid-credential-offer://` URI -- fiddly enough that a second copy would drift.
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
