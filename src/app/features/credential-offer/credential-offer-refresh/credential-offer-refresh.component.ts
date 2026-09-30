import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ThemeService } from 'src/app/core/services/theme.service';
import { CredentialOfferRefreshService } from './services/credential-offer-refresh.service';

type RefreshState = 'idle' | 'loading' | 'success' | 'already-active' | 'error';

// Problem Details (RFC 7807) `type` the backend returns when the credential behind the
// offer is already active. Matched on `type` rather than on the status code so the screen
// keeps working if the backend moves this case from 410 to another status.
const CREDENTIAL_ALREADY_ACTIVE = 'CREDENTIAL_ALREADY_ACTIVE';

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
      error: (error: unknown) => this.state.set(this.isAlreadyActive(error) ? 'already-active' : 'error')
    });
  }

  private isAlreadyActive(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.error?.type === CREDENTIAL_ALREADY_ACTIVE;
  }
}
