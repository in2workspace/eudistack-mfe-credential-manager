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

  // AD-1: el catálogo emitible se deriva del metadata ya filtrado por tenant en el backend
  // (read side de EUD-72). ISSUANCE_CREDENTIAL_TYPES_ARRAY interviene solo como guarda de
  // renderizabilidad: un tipo sin CredentialIssuanceSchemaProvider haría explotar
  // IssuanceSchemaBuilder.getBuilder(). Nunca añade tipos que el metadata no traiga.
  private readonly issuableTypes = computed<IssuanceCredentialType[]>(() => {
    const configs = this.configurations();
    if (!configs) return [];

    const derived = new Set<IssuanceCredentialType>();
    for (const config of Object.values(configs)) {
      // Mismo predicado que findConfigurationsForType(): si un tipo se derivase de otra
      // fuente, aparecería en el selector sin opciones de formato asociadas.
      for (const declaredType of config.credential_definition?.type ?? []) {
        const renderableType = ISSUANCE_CREDENTIAL_TYPES_ARRAY.find(known => declaredType.startsWith(known));
        if (renderableType) derived.add(renderableType);
      }
    }
    // Object.values conserva el orden de declaración del metadata => orden estable en el selector.
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
      // EC-04: fail-closed. El error no se propaga (el flujo de la pantalla no debe romperse),
      // pero se marca para que la UI distinga "sin formularios habilitados" (EC-01) de
      // "catálogo no disponible" (EC-04). Nunca se rellena con un fallback.
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
