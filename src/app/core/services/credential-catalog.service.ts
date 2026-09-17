import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, tap, timeout } from 'rxjs';
import { API_PATH } from '../constants/api-paths.constants';
import { TenantService } from './tenant.service';
import { CredentialCatalogEntry } from '../models/dto/credential-catalog.dto';
import { DeliveryEligibilitySnapshot, resolveDeliveryEligibility } from '../models/entity/delivery-eligibility-snapshot';

/**
 * Read-side adapter for `GET /api/v1/backoffice/credential-catalog` (EUD-169), canonical for the
 * whole app (EUD-233 AD-2). The write side (`PUT`) stays in
 * `features/settings/catalog/credential-catalog-admin.service.ts`, the only screen that mutates the
 * catalogue -- this service never writes.
 *
 * The URL is built from `TenantService.serverUrl`, not `environment.server_url`: the OIDC config
 * declares `secureRoutes: [serverUrl]`, and `AuthInterceptor` only attaches the Bearer token to URLs
 * matching it (see the settings service this was extracted from).
 */
@Injectable({ providedIn: 'root' })
export class CredentialCatalogService {
  private static readonly CATALOG_READ_TIMEOUT_MS = 30_000;

  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  private get catalogUrl() { return this.tenantService.serverUrl + API_PATH.CREDENTIAL_CATALOG; }

  /**
   * Every type of the global registry with its `enabled` flag and (EUD-169) delivery-mode fields,
   * raw. Consumed by `CredentialCatalogAdminService` for the settings screen, which needs the literal
   * array -- including disabled and empty-modes entries the issuance form's projection would hide.
   */
  fetchCatalog(): Observable<CredentialCatalogEntry[]> {
    return this.http.get<CredentialCatalogEntry[]>(this.catalogUrl);
  }

  /**
   * Resolves the tenant's delivery-mode eligibility for the issuance form (EUD-233 AD-9). Never
   * fails the stream: any non-2xx status (including the 404 `credential_catalog_not_configured`), a
   * network error, or a read that exceeds the timeout all degrade internally to catalogue state 4
   * (`{ status: 'unreadable' }`) rather than propagating an error -- the issuance form must keep
   * working in that state (ES-08), it must not fail closed the way `loadIssuanceUiPolicy` does.
   *
   * Emits the AC-11 diagnostic here, in this `tap`, exactly once per affected `configId` per read --
   * never in a `computed`, which would re-emit on every recomputation the view triggers (R-10).
   */
  loadDeliveryEligibility(): Observable<DeliveryEligibilitySnapshot> {
    return this.fetchCatalog().pipe(
      timeout(CredentialCatalogService.CATALOG_READ_TIMEOUT_MS),
      map(entries => resolveDeliveryEligibility(entries)),
      tap(snapshot => this.warnAboutEmptyEligibility(snapshot)),
      catchError(() => of(resolveDeliveryEligibility(undefined)))
    );
  }

  private warnAboutEmptyEligibility(snapshot: DeliveryEligibilitySnapshot): void {
    if (snapshot.status !== 'read') {
      return;
    }
    for (const [configId, modes] of snapshot.modesByConfigId) {
      if (modes.length === 0) {
        // configId is server-controlled (tenant catalogue) -- kept as its own argument rather than
        // interpolated into the template string so it can't inject newlines/control characters
        // into the log line.
        console.warn('Credential configuration has no eligible delivery modes; excluded from the issuance type list.', configId);
      }
    }
  }
}
