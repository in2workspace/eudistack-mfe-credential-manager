import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { KNOWLEDGEBASE_PATH } from 'src/app/core/constants/knowledge.constants';
import { TenantService } from 'src/app/core/services/tenant.service';
import { ThemeService } from 'src/app/core/services/theme.service';

@Component({
  selector: 'app-tenant-not-found',
  templateUrl: './tenant-not-found.component.html',
  styleUrls: ['./tenant-not-found.component.scss'],
  imports: [NgIf, TranslatePipe],
})
export class TenantNotFoundComponent {
  public readonly fallbackUrl = inject(TenantService).buildFallbackUrl();
  public readonly hostname = window.location.hostname;
  private readonly themeService = inject(ThemeService);
  public readonly guidesUrl = this.themeService.knowledgeBaseUrl
    ? this.themeService.knowledgeBaseUrl + KNOWLEDGEBASE_PATH.USERS_TROUBLESHOOTING
    : null;

  public goToFallback(): void {
    window.location.href = this.fallbackUrl;
  }
}
