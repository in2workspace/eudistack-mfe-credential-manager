import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { KNOWLEDGEBASE_PATH } from 'src/app/core/constants/knowledge.constants';
import { ThemeService } from 'src/app/core/services/theme.service';
import { TenantService } from 'src/app/core/services/tenant.service';

@Component({
    selector: 'app-credential-offer-onboarding',
    imports: [QRCodeComponent, TranslatePipe],
    templateUrl: './credential-offer-onboarding.component.html',
    styleUrl: './credential-offer-onboarding.component.scss'
})
export class CredentialOfferOnboardingComponent {
  private readonly themeService = inject(ThemeService);
  private readonly tenantService = inject(TenantService);
  public qrColor = "#2d58a7";
  public walletUsersGuideUrl = this.themeService.knowledgeBaseUrl + KNOWLEDGEBASE_PATH.WALLET;

  public get walletUrl(): string {
    return this.tenantService.defaultWalletUrl() ?? this.tenantService.walletUrl();
  }

  public get walletEnvUrl(): string {
    return this.tenantService.walletUrl();
  }

  public get showEnvWallet(): boolean {
    return this.tenantService.defaultWalletUrl() !== null;
  }
}
