import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PATH } from '../constants/api-paths.constants';
import { MeResponse } from '../models/dto/me-response.dto';
import { TenantService } from './tenant.service';

/**
 * Calls the Issuer `GET /api/v1/me` endpoint to resolve the caller's role
 * against the current tenant. The backend resolves TenantAdmin using
 * `tenant_config.admin_organization_id` (per tenant), so the frontend never
 * needs to know that value.
 */
@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  private get url() { return `${this.tenantService.serverUrl}${API_PATH.ME}`; }

  public fetchMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(this.url);
  }
}
