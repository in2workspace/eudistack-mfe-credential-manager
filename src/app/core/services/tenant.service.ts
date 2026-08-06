import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, retry, timer } from 'rxjs';
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

  /**
   * Memoizes the in-flight/completed resolution *within a single page load*.
   * resolve() is called independently from main.ts's APP_INITIALIZER *and* from
   * TenantAwareStsConfigLoader.loadConfigs() (invoked whenever the OIDC library
   * needs its config) — without this, each call fired its own
   * /assets/tenants/custom-domain.json fetch.
   */
  private resolvePromise: Promise<void> | null = null;

  /**
   * sessionStorage key for the cross-page-load cache — see doResolve() below for why
   * this exists. Versioned so a future shape change doesn't need to special-case
   * reading an old cached payload; a mismatched/unparsable entry is just ignored.
   */
  private static readonly CACHE_KEY = 'eudistack_tenant_resolution_v1';

  async resolve(): Promise<void> {
    return this.resolvePromise ??= this.doResolve();
  }

  /**
   * For a non-canonical (custom-domain) tenant, `tenant`/`canonical` only resolve
   * once /assets/tenants/custom-domain.json is fetched — unlike a canonical tenant,
   * where they're derived synchronously from the hostname (see below). That resolved
   * `tenant` feeds directly into the OIDC clientId, which keys the PKCE state
   * angular-auth-oidc-client stores in sessionStorage.
   *
   * The silent-SSO round trip is TWO independent full-page bootstraps (the page that
   * launches authorize(), and the page that receives its callback) — each makes its
   * OWN fetch of that same static JSON. In-memory memoization (resolvePromise above)
   * only guarantees agreement *within* one of those loads; it does nothing for
   * agreement *across* them. If that fetch transiently failed on just one of the two
   * (STG network blip, cold CDN cache) even after retries, the resulting clientId
   * differed between them, and angular-auth-oidc-client could no longer find the
   * stored PKCE state matching the URL's — "could not find matching config for
   * state X" (EUDISTACK-548 investigation; confirmed live against STG).
   *
   * Caching the resolved result in sessionStorage (scoped to this origin, so
   * intrinsically scoped to this hostname/tenant) closes that gap: once the FIRST
   * page load resolves successfully, every later page load in the same tab —
   * including the SSO callback — reads the cached value synchronously, with no
   * network call and thus no chance of a differing outcome.
   */
  private async doResolve(): Promise<void> {
    if (this.readCache()) {
      return;
    }

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
        this.http.get<CustomDomainConfig>('/assets/tenants/custom-domain.json').pipe(
          // Transient failures here (STG network blips, cold CDN cache) used to leave
          // `tenant` at its default '' — see resolvePromise doc above for why that's
          // more than cosmetic for non-canonical tenants.
          retry({ count: 2, delay: (_, attempt) => timer(attempt * 300) })
        )
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

      // Only cache a resolution that actually landed on a tenant — an empty tenant
      // (e.g. an unmapped canonical hostname) must keep hitting the network so a
      // later successful attempt (this tab, this hostname) can still self-heal.
      if (this._tenant()) {
        this.writeCache();
      }
    } catch (err) {
      // JSON not found or network error, even after retries — wallet URL stays as origin
      // fallback for canonical; for non-canonical, tenant stays '' → guard redirects to
      // /tenant-not-found. Logged (was silent) since a non-canonical tenant silently
      // resolving empty here also corrupts the OIDC clientId used for SSO (see resolvePromise doc).
      console.error('[TenantResolver] Failed to load /assets/tenants/custom-domain.json after retries', err);
    }
  }

  /**
   * Reads a previous successful resolution back from sessionStorage, if this
   * tab/origin already has one. Returns true (and populates the signals) on a hit,
   * false on a miss (no entry, or an unparsable/malformed one — treated the same as
   * no entry rather than thrown, since this cache is purely an optimization and
   * must never be the reason resolution fails).
   */
  private readCache(): boolean {
    try {
      const raw = sessionStorage.getItem(TenantService.CACHE_KEY);
      if (!raw) return false;

      const cached = JSON.parse(raw);
      if (cached?.hostname !== window.location.hostname || !cached?.tenant) {
        return false;
      }

      this._tenant.set(cached.tenant);
      this._canonical.set(!!cached.canonical);
      this._iamUrl.set(cached.iamUrl ?? '');
      this._walletUrl.set(cached.walletUrl ?? WALLET_ORIGIN_BASE_URL);
      this._defaultWalletUrl.set(cached.defaultWalletUrl ?? null);
      return true;
    } catch {
      return false;
    }
  }

  private writeCache(): void {
    try {
      sessionStorage.setItem(TenantService.CACHE_KEY, JSON.stringify({
        hostname: window.location.hostname,
        tenant: this._tenant(),
        canonical: this._canonical(),
        iamUrl: this._iamUrl(),
        walletUrl: this._walletUrl(),
        defaultWalletUrl: this._defaultWalletUrl(),
      }));
    } catch {
      // sessionStorage unavailable (private browsing quota, etc.) — resolution
      // already succeeded for this page load, just skip the cross-page-load cache.
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
