import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PATH } from 'src/app/core/constants/api-paths.constants';
import { TenantService } from 'src/app/core/services/tenant.service';
import { CredentialCatalogService } from 'src/app/core/services/credential-catalog.service';
import { CredentialCatalogEntry, UpdateCredentialCatalogRequest } from './catalog.models';

/**
 * Admin API client for the per-tenant credential catalog (EUD-72). Owns only what the settings
 * screen needs beyond a read: mutating it (`PUT`). The `GET` used to live here too, but is now the
 * canonical `CredentialCatalogService` in `core/services/` (EUD-233 AD-2) -- this class delegates to
 * it rather than duplicating the request, so there is exactly one adapter for the endpoint.
 *
 * The `PUT` URL is still built from `TenantService.serverUrl`, not `environment.server_url`: the OIDC
 * config declares `secureRoutes: [serverUrl]` (see `oidc-config.builder.ts`), and
 * `AuthInterceptor` only attaches the Bearer token to URLs matching it. With an empty
 * `environment.server_url` the fallback is `window.location.origin + '/issuer'`, so
 * reading it from the environment directly would yield a relative URL, no Bearer, and 401.
 *
 * No tenant header is sent: the backend's `TenantDomainWebFilter` falls back to the first
 * segment of the request host, which the browser already provides.
 */
@Injectable({ providedIn: 'root' })
export class CredentialCatalogAdminService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);
  private readonly credentialCatalogService = inject(CredentialCatalogService);

  private get catalogUrl() { return this.tenantService.serverUrl + API_PATH.CREDENTIAL_CATALOG; }

  /**
   * Every type of the global registry with its `enabled` flag for the current tenant, raw --
   * including disabled entries and entries with no eligible delivery modes, which the admin must be
   * able to see and fix (EUD-233 AD-11 leaves this screen unaffected on purpose).
   */
  getCatalog(): Observable<CredentialCatalogEntry[]> {
    return this.credentialCatalogService.fetchCatalog();
  }

  /** Replaces the whole enabled set for the current tenant. Responds 200 with an empty body. */
  updateCatalog(enabledConfigurationIds: string[]): Observable<void> {
    const body: UpdateCredentialCatalogRequest = { enabledConfigurationIds };
    return this.http.put<void>(this.catalogUrl, body);
  }
}
