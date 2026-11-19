import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PATH } from 'src/app/core/constants/api-paths.constants';
import { TenantService } from 'src/app/core/services/tenant.service';
import { AuditEventsPage, AuditPeriod } from '../models/audit-event.model';

export const AUDIT_PAGE_SIZE = 100;

/**
 * Reads the audit events of the tenant from the audit API (EUD-293), the only way the section gets them.
 *
 * The URL is built from `TenantService.auditUrl`, which `oidc-config.builder.ts` declares in
 * `secureRoutes`: only then does the auth interceptor attach the session token.
 */
@Injectable({ providedIn: 'root' })
export class AuditEventsService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  /**
   * One page of the period, newest first. Every page of a listing is asked with the same period and
   * `order`: the cursor of the API belongs to them.
   */
  public list(period: AuditPeriod, cursor?: string): Observable<AuditEventsPage> {
    let params = new HttpParams()
      .set('from', period.from.toISOString())
      .set('to', period.to.toISOString())
      .set('order', 'desc')
      .set('limit', AUDIT_PAGE_SIZE);
    if (cursor) {
      params = params.set('cursor', cursor);
    }
    return this.http.get<AuditEventsPage>(`${this.tenantService.auditUrl}${API_PATH.AUDIT_EVENTS}`, { params });
  }
}
