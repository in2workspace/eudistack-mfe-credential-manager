import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { API_PATH } from '../constants/api-paths.constants';
import { keepLatestCredentialConfigurations } from '../helpers/credential-configuration-id';
import { CredentialConfigurationDto, CredentialIssuerMetadataDto } from '../models/dto/credential-issuer-metadata.dto';
import { ISSUANCE_CREDENTIAL_TYPES_ARRAY, IssuanceCredentialType } from '../models/entity/lear-credential-issuance';
import { IssuanceUiPolicyService } from './issuance-ui-policy.service';
import { TenantService } from './tenant.service';

/** A configuration paired with the record key it was declared under. */
interface KeyedCredentialConfiguration {
  readonly configId: string;
  readonly config: CredentialConfigurationDto;
}

/**
 * The credential type token(s) a configuration declares, read from the parameter its own
 * format defines for that purpose (OID4VCI 1.0 Final section 12.2.4 + Appendix A):
 * `credential_definition.type` for the W3C VC formats, `vct` for dc+sd-jwt, `doctype` for
 * mso_mdoc. A configuration that declares none matches nothing, which is the fail-closed
 * behaviour the selectors want.
 *
 * Not read from the configuration id: `<type>.<format-family>.<version>` is a naming
 * convention of ours (see `credential-configuration-id.ts`, explicitly temporary), so an id
 * that is misnamed — or simply named by someone else — would route the form to the wrong
 * schema. These parameters are the normative statement of what the credential is.
 */
function declaredTypeTokens(config: CredentialConfigurationDto): string[] {
  switch (config.format) {
    case 'jwt_vc_json':
    case 'jwt_vc_json-ld':
    case 'ldp_vc':
      return config.credential_definition?.type ?? [];
    case 'dc+sd-jwt':
      return config.vct ? [config.vct] : [];
    case 'mso_mdoc':
      return config.doctype ? [config.doctype] : [];
    default:
      return [];
  }
}

/**
 * Whether a configuration declares `type`, either as the type token itself or as a versioned
 * token of that lineage (`learcredential.employee.sd.1`).
 *
 * The separator is part of the comparison so `learcredential.employee` cannot swallow a
 * hypothetical `learcredential.employeeextra`.
 */
function declaresType(config: CredentialConfigurationDto, type: IssuanceCredentialType): boolean {
  return declaredTypeTokens(config).some(token => token === type || token.startsWith(`${type}.`));
}

@Injectable({ providedIn: 'root' })
export class CredentialIssuerMetadataService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantService);
  private readonly issuanceUiPolicy = inject(IssuanceUiPolicyService);
  private readonly configurations = signal<Record<string, CredentialConfigurationDto> | null>(null);
  private readonly loadFailed = signal<boolean>(false);

  /**
   * The registry reduced to what this UI may offer: the lineages the tenant's published
   * policy allows, each at the newest version the metadata declares.
   *
   * Two independent rules, in this order. The POLICY (per tenant, published as configuration —
   * see `issuance-ui-policy.service.ts`) decides WHICH type+format lineages get a form at all:
   * the metadata is already tenant-scoped by the issuer and everything in it is issuable
   * THROUGH THE API, but this UI deliberately offers a narrower set. Then
   * `keepLatestCredentialConfigurations` — the same rule the catalog screen applies to its
   * rows — decides WHICH VERSION of a surviving lineage, so a version the admin can no longer
   * see in the catalog is not offered for issuance either.
   *
   * Keyed on the RECORD KEY, not on `credential_definition.type`: the key is the
   * configuration id (`learcredential.employee.w3c.2`), which is what the version grammar
   * describes and what the issuance request carries. Superseded versions are still reachable
   * through `getConfigurationById()` / `getAllConfigurations()`, which must keep resolving
   * already-issued credentials whatever version they were issued under.
   *
   * Unversioned keys are dropped by the helper. That is deliberate: an id that does not
   * follow the grammar cannot be shown to be the newest of anything, and offering it would
   * put a second control next to the version it may well be an older copy of.
   */
  private readonly latestConfigurations = computed<KeyedCredentialConfiguration[]>(() => {
    const configs = this.configurations();
    if (!configs) return [];

    // Object.entries preserves the metadata's declaration order, and the helper preserves
    // relative order => stable order in both selectors.
    const keyed = Object.entries(configs).map(([configId, config]) => ({ configId, config }));

    // The policy only ever narrows: an id absent from the metadata cannot be added back by
    // the document, and an unusable document leaves an empty policy (fail-closed), flagged
    // through IssuanceUiPolicyService.loadFailed() so the screen can explain itself.
    const offerableByUi = keyed.filter(entry => this.issuanceUiPolicy.allows(entry.configId));

    return keepLatestCredentialConfigurations(offerableByUi, entry => entry.configId);
  });

  // AD-1: the issuable catalogue is derived from the metadata, already tenant-filtered on
  // the backend (EUD-72 read side). ISSUANCE_CREDENTIAL_TYPES_ARRAY only acts as a
  // renderability guard: a type with no CredentialIssuanceSchemaProvider would blow up
  // IssuanceSchemaBuilder.getBuilder(). It never adds types the metadata doesn't bring.
  private readonly issuableTypes = computed<IssuanceCredentialType[]>(() => {
    const derived = new Set<IssuanceCredentialType>();
    // Derived from the version-filtered set, like findConfigurationsForType(): a type known
    // only through a superseded or unversioned configuration would otherwise reach the
    // selector with no format option behind it.
    for (const { config } of this.latestConfigurations()) {
      // Same predicate as findConfigurationsForType(): if a type were derived from another
      // source, it would show up in the selector with no associated format options.
      const renderableType = ISSUANCE_CREDENTIAL_TYPES_ARRAY.find(known => declaresType(config, known));
      if (renderableType) derived.add(renderableType);
    }
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

  /**
   * The configurations of `type` the issuance form may offer: one per format, always the
   * newest version of it (see `latestConfigurations`).
   *
   * One entry per type+format is what keeps the format selector to a single radio button per
   * format — two versions of the same lineage carry the same `format`, so before filtering
   * they rendered as two controls with the identical label and no way to tell them apart.
   */
  findConfigurationsForType(type: IssuanceCredentialType): Array<{ configId: string; format: string }> {
    return this.latestConfigurations()
      .filter(({ config }) => declaresType(config, type))
      .map(({ configId, config }) => ({ configId, format: config.format }));
  }

  getConfigurationById(configId: string): CredentialConfigurationDto | undefined {
    return this.configurations()?.[configId] ?? undefined;
  }

  getAllConfigurations(): Record<string, CredentialConfigurationDto> | null {
    return this.configurations();
  }
}