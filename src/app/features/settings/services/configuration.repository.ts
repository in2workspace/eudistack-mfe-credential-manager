import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {SignatureConfigPayload} from '../models/configuration.models'
import {API_PATH} from 'src/app/core/constants/api-paths.constants';
import { TenantService } from 'src/app/core/services/tenant.service';
@Injectable({ providedIn: 'root' })
export class ConfigurationRepository {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);

  private get configurationUrl() { return this.tenantService.serverUrl + API_PATH.CONFIGURATION; }

  saveConfig(payload: SignatureConfigPayload): Observable<void> {
    return this.http.post<void>(this.configurationUrl, payload);
  }

  getConfig(): Observable<SignatureConfigPayload> {
    return this.http.get<SignatureConfigPayload>(this.configurationUrl);
  }

  updateConfiguration(payload: Partial<SignatureConfigPayload>): Observable<void> {
    return this.http.patch<void>(this.configurationUrl, payload);
  }


}
