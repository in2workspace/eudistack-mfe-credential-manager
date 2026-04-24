import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { environment } from 'src/environments/environment';
import { QRCodeComponent } from 'angularx-qrcode';
import { KNOWLEDGEBASE_PATH } from 'src/app/core/constants/knowledge.constants';
import { ThemeService } from 'src/app/core/services/theme.service';
import { WALLET_BASE_URL } from 'src/app/core/constants/wallet.constants';

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

  public walletUrl = WALLET_BASE_URL;
  public walletTestUrl = WALLET_BASE_URL;
  public readonly showWalletSameDeviceUrlTest = environment.show_wallet_url_test;
}
