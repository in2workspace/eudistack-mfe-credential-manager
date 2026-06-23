import { Component, computed, EventEmitter, inject, input, Output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { MatIcon } from '@angular/material/icon';
import { KNOWLEDGEBASE_PATH } from 'src/app/core/constants/knowledge.constants';
import { WALLET_CALLBACK_PATH } from 'src/app/core/constants/wallet.constants';
import { ThemeService } from 'src/app/core/services/theme.service';
import { TenantService } from 'src/app/core/services/tenant.service';

@Component({
    selector: 'app-credential-offer',
    templateUrl: './credential-offer.component.html',
    styleUrls: ['./credential-offer.component.scss'],
    imports: [QRCodeComponent, TranslatePipe, MatIcon]
})
export class CredentialOfferComponent {
  private readonly themeService = inject(ThemeService);
  private readonly tenantService = inject(TenantService);
  @Output() public refreshCredential = new EventEmitter<void>();
  public qrColor = "#000000";
  public copied = false;
  public walletUsersGuideUrl = this.themeService.knowledgeBaseUrl + KNOWLEDGEBASE_PATH.WALLET;
  public credentialOfferUri$ = input.required<string>();

  public get showEnvWallet(): boolean {
    return this.tenantService.defaultWalletUrl() !== null;
  }

  public walletMainUrl$ = computed<string>(() => {
    const base = this.tenantService.defaultWalletUrl() ?? this.tenantService.walletUrl();
    const httpsUrl = this.extractCredentialOfferHttpsUrl(this.credentialOfferUri$());
    return base + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(httpsUrl);
  });

  public walletEnvUrl$ = computed<string>(() => {
    const httpsUrl = this.extractCredentialOfferHttpsUrl(this.credentialOfferUri$());
    return this.tenantService.walletUrl() + WALLET_CALLBACK_PATH + '?credential_offer_uri=' + encodeURIComponent(httpsUrl);
  });

  private extractCredentialOfferHttpsUrl(oid4vciUri: string): string {
    try {
      return new URL(oid4vciUri).searchParams.get('credential_offer_uri') ?? oid4vciUri;
    } catch {
      return oid4vciUri;
    }
  }

  public copyQrContent(): void {
    navigator.clipboard.writeText(this.credentialOfferUri$());
    this.copied = true;
    setTimeout(() => this.copied = false, 2000);
  }

  public onRefreshCredentialClick(event: Event): void {
    event.preventDefault();
    this.refreshCredential.emit();
  }
}
