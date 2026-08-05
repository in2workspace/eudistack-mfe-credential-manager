import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PATH } from 'src/app/core/constants/api-paths.constants';
import { TenantService } from 'src/app/core/services/tenant.service';
import { CredentialCatalogEntry, UpdateCredentialCatalogRequest } from './catalog.models';

/**
 * Admin API client for the per-tenant credential catalog (EUD-72).
 *
 * The URL is built from `TenantService.serverUrl`, not `environment.server_url`: the OIDC
 * config declares `secureRoutes: [serverUrl]` (see `oidc-config.builder.ts`), and
 * `AuthInterceptor` only attaches the Bearer token to URLs matching it. With an empty
 * `environment.server_url` the fallback is `window.location.origin + '/issuer'`, so
 * reading it from the environment directly would yield a relative URL, no Bearer, and 401.
 *
 * No tenant header is sent: the backend's `TenantDomainWebFilter` falls back to the first
 * segment of the request host, which the browser already provides.
 */
@Injectable({ providedIn: 'root' })
export class CredentialCatalogService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  private get catalogUrl() { return this.tenantService.serverUrl + API_PATH.CREDENTIAL_CATALOG; }

  /** Every type of the global registry with its `enabled` flag for the current tenant. */
  getCatalog(): Observable<CredentialCatalogEntry[]> {
    return this.http.get<CredentialCatalogEntry[]>(this.catalogUrl);
  }

  /** Replaces the whole enabled set for the current tenant. Responds 200 with an empty body. */
  updateCatalog(enabledConfigurationIds: string[]): Observable<void> {
    const body: UpdateCredentialCatalogRequest = { enabledConfigurationIds };
    return this.http.put<void>(this.catalogUrl, body);
  }
}
