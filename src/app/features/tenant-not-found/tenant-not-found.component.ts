import { Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { buildFallbackUrl } from 'src/app/core/constants/tenants.constants';

@Component({
  selector: 'app-tenant-not-found',
  templateUrl: './tenant-not-found.component.html',
  styleUrls: ['./tenant-not-found.component.scss'],
  imports: [TranslatePipe],
})
export class TenantNotFoundComponent {
  public readonly fallbackUrl = buildFallbackUrl();
  public readonly hostname = window.location.hostname;

  public goToFallback(): void {
    window.location.href = this.fallbackUrl;
  }
}
