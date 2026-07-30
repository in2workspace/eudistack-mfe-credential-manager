import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { API_PATH } from '../constants/api-paths.constants';
import { CredentialConfigurationDto, CredentialIssuerMetadataDto } from '../models/dto/credential-issuer-metadata.dto';
import { ISSUANCE_CREDENTIAL_TYPES_ARRAY, IssuanceCredentialType } from '../models/entity/lear-credential-issuance';
import { TenantService } from './tenant.service';

@Injectable({ providedIn: 'root' })
export class CredentialIssuerMetadataService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);
  private readonly configurations = signal<Record<string, CredentialConfigurationDto> | null>(null);
  private readonly loadFailed = signal<boolean>(false);

  // AD-1: the issuable catalogue is derived from the metadata, already tenant-filtered on
  // the backend (EUD-72 read side). ISSUANCE_CREDENTIAL_TYPES_ARRAY only acts as a
  // renderability guard: a type with no CredentialIssuanceSchemaProvider would blow up
  // IssuanceSchemaBuilder.getBuilder(). It never adds types the metadata doesn't bring.
  private readonly issuableTypes = computed<IssuanceCredentialType[]>(() => {
    const configs = this.configurations();
    if (!configs) return [];

    const derived = new Set<IssuanceCredentialType>();
    for (const config of Object.values(configs)) {
      // Same predicate as findConfigurationsForType(): if a type were derived from another
      // source, it would show up in the selector with no associated format options.
      for (const declaredType of config.credential_definition?.type ?? []) {
        const renderableType = ISSUANCE_CREDENTIAL_TYPES_ARRAY.find(known => declaredType.startsWith(known));
        if (renderableType) derived.add(renderableType);
      }
    }
    // Object.values preserves the metadata's declaration order => stable order in the selector.
    return [...derived];
  });

  loadMetadata(): Observable<void> {
    const url = this.tenantService.serverUrl + API_PATH.CREDENTIAL_ISSUER_METADATA;
    return this.http.get<CredentialIssuerMetadataDto>(url).pipe(
      tap(meta => {
        this.configurations.set(meta.credential_configurations_supported);
        this.loadFailed.set(false);
      }),
      map(() => void 0),
      // EC-04: fail-closed. The error is not propagated (the screen's flow must not break),
      // but it is flagged so the UI can distinguish "no forms enabled" (EC-01) from
      // "catalogue unavailable" (EC-04). It is never filled in with a fallback.
      catchError(() => {
        this.configurations.set(null);
        this.loadFailed.set(true);
        return of(void 0);
      })
    );
  }

  getIssuableCredentialTypes(): IssuanceCredentialType[] {
    return this.issuableTypes();
  }

  hasMetadataLoadFailed(): boolean {
    return this.loadFailed();
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

  getAllConfigurations(): Record<string, CredentialConfigurationDto> | null {
    return this.configurations();
  }
}
