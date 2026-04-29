import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_PATH } from 'src/app/core/constants/api-paths.constants';

@Injectable({ providedIn: 'root' })
export class CredentialOfferRefreshService {
  private readonly http = inject(HttpClient);

  refreshCredentialOffer(token: string): Observable<void> {
    return this.http.post<void>(
      `${environment.server_url}${API_PATH.CREDENTIAL_OFFER_REFRESH}/${token}`,
      null
    );
  }
}
