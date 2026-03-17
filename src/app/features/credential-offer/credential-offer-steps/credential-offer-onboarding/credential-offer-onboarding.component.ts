import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { environment } from 'src/environments/environment';
import { QRCodeComponent } from 'angularx-qrcode';
import { KNOWLEDGEBASE_PATH } from 'src/app/core/constants/knowledge.constants';
import { ThemeService } from 'src/app/core/services/theme.service';

@Component({
    selector: 'app-credential-offer-onboarding',
    imports: [QRCodeComponent, TranslatePipe],
    templateUrl: './credential-offer-onboarding.component.html',
    styleUrl: './credential-offer-onboarding.component.scss'
})
export class CredentialOfferOnboardingComponent{
  private readonly themeService = inject(ThemeService);
  public qrColor = "#2d58a7";
  public walletUsersGuideUrl = this.themeService.knowledgeBaseUrl + KNOWLEDGEBASE_PATH.WALLET;

  public walletUrl = environment.wallet_url || 'https://wallet.dome-marketplace.eu/';
  public walletTestUrl = environment.wallet_url_test || 'https://wallet.dome-marketplace.eu/';
  public readonly showWalletSameDeviceUrlTest =  environment.show_wallet_url_test;
}
