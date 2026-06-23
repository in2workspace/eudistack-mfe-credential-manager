import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ENV_SUFFIXES, FALLBACK_TENANT, KNOWN_TENANTS, MFE_HOME_PATH } from '../constants/tenants.constants';
import { WALLET_ORIGIN_BASE_URL } from '../constants/wallet.constants';
import { environment } from 'src/environments/environment';
import { CustomDomainConfig } from '../models/custom-domain-config.model';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private readonly _tenant = signal<string>('');
  private readonly _canonical = signal<boolean>(false);
  private readonly _iamUrl = signal<string>('');
  private readonly _walletUrl = signal<string>(WALLET_ORIGIN_BASE_URL);
  private readonly _defaultWalletUrl = signal<string | null>(null);
  readonly tenant = this._tenant.asReadonly();
  readonly canonical = this._canonical.asReadonly();
  readonly iamUrl = this._iamUrl.asReadonly();
  /** Environment-specific wallet base URL (without callback path). */
  readonly walletUrl = this._walletUrl.asReadonly();
  /** Main wallet base URL from the tenant's defaultEnv. Null when defaultEnv is not configured. */
  readonly defaultWalletUrl = this._defaultWalletUrl.asReadonly();
  readonly serverUrl = environment.server_url || (window.location.origin + "/issuer");

  async resolve(): Promise<void> {
    const tenantFromHostname = this.extractFromHostname(window.location.hostname);
    const isCanonical = this.isValidTenant(tenantFromHostname);

    if (isCanonical) {
      this._tenant.set(tenantFromHostname);
      this._canonical.set(true);
      this._iamUrl.set(environment.iam_url || window.location.origin + "/verifier");
      // walletUrl already defaults to WALLET_ORIGIN_BASE_URL
    }

    try {
      const config = await firstValueFrom(
        this.http.get<CustomDomainConfig>('/assets/tenants/custom-domain.json')
      );

      const tenantId = isCanonical
        ? tenantFromHostname
        : config.domains[window.location.hostname]?.tenantId;

      const tenantConfig = tenantId ? config.tenants[tenantId] : undefined;

      if (!isCanonical) {
        const entry = config.domains[window.location.hostname];

        if (entry && this.isValidTenant(entry.tenantId)) {
          this._tenant.set(entry.tenantId);
          this._canonical.set(false);

          const resolvedEnvId = entry.envId || tenantConfig?.defaultEnv;
          const resolvedIamUrl = environment.iam_url
            || (resolvedEnvId ? tenantConfig?.env[resolvedEnvId]?.verifier : undefined)
            || '';
          const resolvedWalletUrl = resolvedEnvId
            ? tenantConfig?.env[resolvedEnvId]?.wallet
            : undefined;

          if (!resolvedEnvId) {
            console.warn(
              `[TenantResolver] Could not resolve environment for hostname "${window.location.hostname}" and tenant "${entry.tenantId}".`
            );
          }

          if (!resolvedIamUrl) {
            console.warn(
              `[TenantResolver] Could not resolve IAM URL for hostname "${window.location.hostname}", tenant "${entry.tenantId}" and env "${resolvedEnvId ?? 'unknown'}".`
            );
          }

          if (!resolvedWalletUrl) {
            console.warn(
              `[TenantResolver] Could not resolve wallet URL for hostname "${window.location.hostname}", tenant "${entry.tenantId}" and env "${resolvedEnvId ?? 'unknown'}". Falling back to default wallet URL.`
            );
          }

          this._iamUrl.set(resolvedIamUrl);
          this._walletUrl.set(resolvedWalletUrl ?? WALLET_ORIGIN_BASE_URL);
        }
      }

      if (tenantConfig?.defaultEnv) {
        this._defaultWalletUrl.set(tenantConfig.env[tenantConfig.defaultEnv]?.wallet ?? null);
      }
    } catch {
      // JSON not found or network error — wallet URL stays as origin fallback for canonical;
      // for non-canonical, tenant stays '' → guard redirects to /tenant-not-found
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
