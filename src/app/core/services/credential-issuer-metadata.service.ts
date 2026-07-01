import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_PATH } from '../constants/api-paths.constants';
import { CredentialConfigurationDto, CredentialIssuerMetadataDto } from '../models/dto/credential-issuer-metadata.dto';
import { IssuanceCredentialType } from '../models/entity/lear-credential-issuance';

@Injectable({ providedIn: 'root' })
export class CredentialIssuerMetadataService {
  private readonly http = inject(HttpClient);
  private readonly configurations = signal<Record<string, CredentialConfigurationDto> | null>(null);

  loadMetadata(): Observable<void> {
    const url = environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA;
    return this.http.get<CredentialIssuerMetadataDto>(url).pipe(
      tap(meta => this.configurations.set(meta.credential_configurations_supported)),
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  findConfigurationsForType(type: IssuanceCredentialType): Array<{ configId: string; format: string }> {
    const configs = this.configurations();
    if (!configs) return [];
    return Object.entries(configs)
      .filter(([, cfg]) => cfg.credential_definition?.type?.some(t => t.startsWith(type)))
      .map(([configId, cfg]) => ({ configId, format: cfg.format }));
  }

  getConfigurationById(configId: string): CredentialConfigurationDto | undefined {
    return this.configurations()?.[configId] ?? undefined;
  }
}
