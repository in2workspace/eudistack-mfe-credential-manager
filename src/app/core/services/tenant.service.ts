import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ENV_SUFFIXES, FALLBACK_TENANT, KNOWN_TENANTS, MFE_HOME_PATH } from '../constants/tenants.constants';
import { environment } from 'src/environments/environment';
import { CustomDomainConfig } from '../models/custom-domain-config.model';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly _tenant = signal<string>('');
  private readonly _canonical = signal<boolean>(false);
  private readonly _iamUrl = signal<string>('');
  readonly tenant = this._tenant.asReadonly();
  readonly canonical = this._canonical.asReadonly();
  readonly iamUrl = this._iamUrl.asReadonly();
  readonly apiBase = computed(() => this.canonical() ? (environment.server_url ?? '') : '');

  async resolve(): Promise<void> {
    const tenantFromHostname = this.extractFromHostname(window.location.hostname);
    if (this.isValidTenant(tenantFromHostname)) {
      this._tenant.set(tenantFromHostname);
      this._canonical.set(true);
      this._iamUrl.set(environment.iam_url ?? '');
      return;
    }

    try {
      const config = await firstValueFrom(
        //todo remove /issuer
        this.http.get<CustomDomainConfig>('/issuer/assets/tenants/custom-domain.json')
      );
      const entry = config.domains[window.location.hostname];
      if (entry && this.isValidTenant(entry.tenantId)) {
        this._tenant.set(entry.tenantId);
        this._canonical.set(false);
        this._iamUrl.set(config.env[entry.envId]?.verifier ?? '');
      }
    } catch {
      // JSON not found or network error — tenant stays '' → guard redirects to /tenant-not-found
    }
  }

  buildFallbackUrl(location: Location = window.location): string {
    const segments = location.hostname.split('.');
    let targetHost: string;

    if (segments.length > 1) {
      const { suffix } = this.stripEnvSuffix(segments[0].toLowerCase());
      targetHost = [`${FALLBACK_TENANT}${suffix}`, ...segments.slice(1)].join('.');
    } else {
      targetHost = location.hostname;
    }

    const port = location.port ? `:${location.port}` : '';
    return `${location.protocol}//${targetHost}${port}${MFE_HOME_PATH}`;
  }

  private extractFromHostname(hostname: string): string {
    const first = hostname.split('.')[0].toLowerCase();
    return this.stripEnvSuffix(first).base;
  }

  private isValidTenant(tenantName: string): boolean {
    return KNOWN_TENANTS.includes(tenantName);
  }

  private stripEnvSuffix(tenant: string): { base: string; suffix: string } {
    const match = ENV_SUFFIXES.find(s => tenant.endsWith(s));
    return match
      ? { base: tenant.slice(0, -match.length), suffix: match }
      : { base: tenant, suffix: '' };
  }
}
