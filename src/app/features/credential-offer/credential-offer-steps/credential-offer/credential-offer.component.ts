import { Component, computed, EventEmitter, inject, input, Output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { MatIcon } from '@angular/material/icon';
import { environment } from 'src/environments/environment';
import { KNOWLEDGEBASE_PATH } from 'src/app/core/constants/knowledge.constants';
import { ThemeService } from 'src/app/core/services/theme.service';
import { WALLET_SAME_DEVICE_URL } from 'src/app/core/constants/wallet.constants';

@Component({
    selector: 'app-credential-offer',
    templateUrl: './credential-offer.component.html',
    styleUrls: ['./credential-offer.component.scss'],
    imports: [QRCodeComponent, TranslatePipe, MatIcon]
})
export class CredentialOfferComponent{
  private readonly themeService = inject(ThemeService);
  @Output() public refreshCredential = new EventEmitter<void>();
  public qrColor = "#000000";
  public copied = false;
  public walletUsersGuideUrl = this.themeService.knowledgeBaseUrl + KNOWLEDGEBASE_PATH.WALLET;
  public credentialOfferUri$ = input.required<string>();

  public readonly walletSameDeviceUrl = WALLET_SAME_DEVICE_URL;
  public walletSameDeviceUrl$ = computed<string>(()=>{
    const httpsUrl = this.extractCredentialOfferHttpsUrl(this.credentialOfferUri$());
    return this.walletSameDeviceUrl + '?credential_offer_uri=' + encodeURIComponent(httpsUrl);
  });

  //TEST URLS
  public readonly showWalletSameDeviceUrlTest =  environment.show_wallet_url_test;
  public readonly walletSameDeviceTestUrl = WALLET_SAME_DEVICE_URL;

  public walletSameDeviceTestUrl$ = computed<string>(()=>{
    const httpsUrl = this.extractCredentialOfferHttpsUrl(this.credentialOfferUri$());
    return this.walletSameDeviceTestUrl + '?credential_offer_uri=' + encodeURIComponent(httpsUrl);
  });

  /**
   * Extracts the HTTPS credential offer URL from the openid-credential-offer:// URI.
   * Input:  openid-credential-offer://?credential_offer_uri=https%3A%2F%2F...
   * Output: https://...
   */
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

public onRefreshCredentialClick(event:Event): void{
  event.preventDefault();
  this.refreshCredential.emit();
}

}
