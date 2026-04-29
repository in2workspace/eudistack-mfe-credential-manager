import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeService } from 'src/app/core/services/theme.service';
import { CredentialOfferRefreshService } from './services/credential-offer-refresh.service';

type RefreshState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-credential-offer-refresh',
  templateUrl: './credential-offer-refresh.component.html',
  styleUrls: ['./credential-offer-refresh.component.scss'],
  imports: [TranslatePipe]
})
export class CredentialOfferRefreshComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly refreshService = inject(CredentialOfferRefreshService);
  private readonly themeService = inject(ThemeService);

  public readonly logoSrc = this.themeService.snapshot?.branding?.logoUrl ?? null;
  public readonly state = signal<RefreshState>('idle');
  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
  }

  sendOffer(): void {
    this.state.set('loading');
    this.refreshService.refreshCredentialOffer(this.token).subscribe({
      next: () => this.state.set('success'),
      error: () => this.state.set('error')
    });
  }
}
