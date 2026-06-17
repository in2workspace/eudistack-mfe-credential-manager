import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_PATH } from 'src/app/core/constants/api-paths.constants';
import { TenantService } from 'src/app/core/services/tenant.service';

@Injectable({ providedIn: 'root' })
export class CredentialOfferRefreshService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  refreshCredentialOffer(token: string): Observable<void> {
    return this.http.post<void>(
      `${this.tenantService.apiBase()}${API_PATH.CREDENTIAL_OFFER_REFRESH}/${token}`,
      null
    );
  }
}
