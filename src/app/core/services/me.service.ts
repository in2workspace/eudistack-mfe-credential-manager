import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_PATH } from '../constants/api-paths.constants';
import { MeResponse } from '../models/dto/me-response.dto';

/**
 * Calls the Issuer `GET /api/v1/me` endpoint to resolve the caller's role
 * against the current tenant. The backend resolves TenantAdmin using
 * `tenant_config.admin_organization_id` (per tenant), so the frontend never
 * needs to know that value.
 */
@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.server_url}${API_PATH.ME}`;

  public fetchMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(this.url);
  }
}
