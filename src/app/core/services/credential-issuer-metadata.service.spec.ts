import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CredentialIssuerMetadataService } from './credential-issuer-metadata.service';
import { environment } from 'src/environments/environment';
import { API_PATH } from '../constants/api-paths.constants';
import { TenantService } from './tenant.service';
import { IssuanceUiPolicyService } from './issuance-ui-policy.service';
import { policyAllowsConfiguration } from '../helpers/issuance-ui-policy';

describe('CredentialIssuerMetadataService', () => {
  let service: CredentialIssuerMetadataService;
  let httpMock: HttpTestingController;

  // Versions at or above the issuance floor (core/temporary/pinned-issuable-versions.ts), so
  // these fixtures exercise the version-independent behaviour rather than the pin.
  const mockMetadata = {
    credential_issuer: 'https://example.com',
    credential_configurations_supported: {
      'learcredential.employee.w3c.4': {
        format: 'jwt_vc_json',
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.4'] }
      },
      'learcredential.employee.mdoc.1': {
        format: 'mso_mdoc',
        doctype: 'learcredential.employee.mdoc.1'
      },
      'learcredential.machine.w3c.3': {
        format: 'jwt_vc_json',
        credential_definition: { type: ['VerifiableCredential', 'learcredential.machine.w3c.3'] }
      },
      'OtherCredential': {
        format: 'jwt_vc_json'
        // no credential_definition
      }
    }
  };

  /**
   * The shape the Issuer publishes since it was made OID4VCI-conformant: section 12.2.4 scopes
   * `credential_definition` to the W3C VC formats, so the dc+sd-jwt configuration carries `vct`
   * and no `credential_definition` at all.
   */
  const mockConformantMetadata = {
    credential_issuer: 'https://example.com',
    credential_configurations_supported: {
      'learcredential.employee.w3c.4': {
        format: 'jwt_vc_json',
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.4'] }
      },
      'learcredential.employee.sd.1': {
        format: 'dc+sd-jwt',
        vct: 'learcredential.employee.sd.1'
      }
    }
  };

  /** Several versions of the same lineage, declared oldest-first and newest-first. */
  const mockVersionedMetadata = {
    credential_issuer: 'https://example.com',
    credential_configurations_supported: {
      'learcredential.employee.w3c.4': {
        format: 'jwt_vc_json',
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.4'] }
      },
      'learcredential.employee.w3c.6': {
        format: 'jwt_vc_json',
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.6'] }
      },
      'learcredential.employee.w3c.5': {
        format: 'jwt_vc_json',
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.5'] }
      },
      'learcredential.employee.sd.2': {
        format: 'dc+sd-jwt',
        vct: 'learcredential.employee.sd.2'
      },
      'learcredential.employee.sd.1': {
        format: 'dc+sd-jwt',
        vct: 'learcredential.employee.sd.1'
      }
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CredentialIssuerMetadataService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: { serverUrl: environment.server_url, getServerUrl: () => environment.server_url} },
        // Policy out of the way: these tests are about the other rules. The real service is
        // fail-closed (empty until the published document loads), so leaving it in would make
        // every fixture below yield nothing. The policy has its own describe at the bottom.
        { provide: IssuanceUiPolicyService, useValue: { allows: () => true, loadFailed: () => false } }
      ]
    });
    service = TestBed.inject(CredentialIssuerMetadataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('loadMetadata()', () => {
    it('should fetch metadata and store configurations', () => {
      let completed = false;
      service.loadMetadata().subscribe(() => { completed = true; });

      const req = httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA);
      expect(req.request.method).toBe('GET');
      req.flush(mockMetadata);

      expect(completed).toBe(true);
    });

    it('should return void on success', (done) => {
      service.loadMetadata().subscribe(result => {
        expect(result).toBeUndefined();
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockMetadata);
    });

    it('should silently catch HTTP errors and return void', (done) => {
      service.loadMetadata().subscribe(result => {
        expect(result).toBeUndefined();
        done();
      });
      const req = httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('findConfigurationsForType()', () => {
    it('should return empty array when metadata not loaded', () => {
      const result = service.findConfigurationsForType('learcredential.employee');
      expect(result).toEqual([]);
    });

    it('should return matching configurations after metadata loaded', (done) => {
      service.loadMetadata().subscribe(() => {
        const result = service.findConfigurationsForType('learcredential.employee');
        expect(result).toHaveLength(2);
        expect(result).toContainEqual({ configId: 'learcredential.employee.w3c.4', format: 'jwt_vc_json' });
        expect(result).toContainEqual({ configId: 'learcredential.employee.mdoc.1', format: 'mso_mdoc' });
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockMetadata);
    });

    it('should offer the sd-jwt format, which declares its type through vct', (done) => {
      service.loadMetadata().subscribe(() => {
        const result = service.findConfigurationsForType('learcredential.employee');

        expect(result).toContainEqual({ configId: 'learcredential.employee.sd.1', format: 'dc+sd-jwt' });
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockConformantMetadata);
    });

    it('should return only the newest version of each format, one entry per format', (done) => {
      service.loadMetadata().subscribe(() => {
        const result = service.findConfigurationsForType('learcredential.employee');

        // 5 configurations, 2 lineages => 2 entries, so the format selector renders exactly
        // one radio button per format instead of one per version.
        expect(result).toEqual([
          { configId: 'learcredential.employee.w3c.6', format: 'jwt_vc_json' },
          { configId: 'learcredential.employee.sd.2', format: 'dc+sd-jwt' }
        ]);
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockVersionedMetadata);
    });

    it('should not return configurations whose id carries no version', (done) => {
      const metaWithUnversionedId = {
        credential_issuer: 'https://example.com',
        credential_configurations_supported: {
          'LEARCredentialEmployee': {
            format: 'jwt_vc_json',
            credential_definition: { type: ['VerifiableCredential', 'learcredential.employee'] }
          }
        }
      };
      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([]);
        done();
      });
      httpMock
        .expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA)
        .flush(metaWithUnversionedId);
    });

    it('should keep superseded versions resolvable by id (already-issued credentials)', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.getConfigurationById('learcredential.employee.w3c.4')).toBeDefined();
        // Keys are dotted ids, so toHaveProperty() would read them as a nested path.
        expect(Object.keys(service.getAllConfigurations() ?? {})).toContain('learcredential.employee.w3c.4');
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockVersionedMetadata);
    });

    it('should return matching configurations for machine type', (done) => {
      service.loadMetadata().subscribe(() => {
        const machineResult = service.findConfigurationsForType('learcredential.machine');
        expect(machineResult).toHaveLength(1);
        expect(machineResult[0]).toEqual({ configId: 'learcredential.machine.w3c.3', format: 'jwt_vc_json' });
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockMetadata);
    });

    it('should ignore the configuration id when it disagrees with the declared type', (done) => {
      // The id grammar is a convention of ours; the format's type parameter is the normative
      // statement. An id that says one thing and a `vct` that says another follows the vct.
      const metaWithMisleadingId = {
        credential_issuer: 'https://example.com',
        credential_configurations_supported: {
          'learcredential.machine.sd.1': {
            format: 'dc+sd-jwt',
            vct: 'learcredential.employee.sd.1'
          }
        }
      };
      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.machine')).toEqual([]);
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.machine.sd.1', format: 'dc+sd-jwt' }
        ]);
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(metaWithMisleadingId);
    });

    it('should not match a configuration of another lineage', (done) => {
      const metaWithNoTypeDef = {
        credential_issuer: 'https://example.com',
        credential_configurations_supported: {
          'SomeConfig': { format: 'jwt_vc_json' }
        }
      };
      service.loadMetadata().subscribe(() => {
        const result = service.findConfigurationsForType('learcredential.employee');
        expect(result).toEqual([]);
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(metaWithNoTypeDef);
    });
  });

  describe('getIssuableCredentialTypes()', () => {
    it('should derive the type from the parameter each format defines for it', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.getIssuableCredentialTypes()).toEqual(['learcredential.employee']);
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockConformantMetadata);
    });

    it('should return an empty list when metadata has not been loaded yet (fail-closed)', () => {
      expect(service.getIssuableCredentialTypes()).toEqual([]);
      expect(service.hasMetadataLoadFailed()).toBe(false);
    });

    it('should derive the issuable types from credential_definition.type, deduplicated across formats', (done) => {
      service.loadMetadata().subscribe(() => {
        const types = service.getIssuableCredentialTypes();

        // two employee configs (jwt_vc_json + mso_mdoc) => a single type
        expect(types).toEqual(['learcredential.employee', 'learcredential.machine']);
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockMetadata);
    });

    it('should not offer a type known only through an unversioned configuration', (done) => {
      // Otherwise the type reaches the selector while findConfigurationsForType() returns
      // nothing for it, i.e. a selectable type with no format behind it.
      const metaWithUnversionedId = {
        credential_issuer: 'https://example.com',
        credential_configurations_supported: {
          'LEARCredentialEmployee': {
            format: 'jwt_vc_json',
            credential_definition: { type: ['VerifiableCredential', 'learcredential.employee'] }
          }
        }
      };
      service.loadMetadata().subscribe(() => {
        expect(service.getIssuableCredentialTypes()).toEqual([]);
        done();
      });
      httpMock
        .expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA)
        .flush(metaWithUnversionedId);
    });

    it('should ignore configurations without credential_definition', (done) => {
      const metaWithoutTypeDef = {
        credential_issuer: 'https://example.com',
        credential_configurations_supported: {
          'SomeConfig': { format: 'jwt_vc_json' }
        }
      };
      service.loadMetadata().subscribe(() => {
        expect(service.getIssuableCredentialTypes()).toEqual([]);
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(metaWithoutTypeDef);
    });

    it('should not fall back to a hardcoded catalogue when the metadata request fails (EC-04)', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.getIssuableCredentialTypes()).toEqual([]);
        expect(service.hasMetadataLoadFailed()).toBe(true);
        done();
      });
      httpMock
        .expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA)
        .flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should clear the failure flag after a successful reload', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.hasMetadataLoadFailed()).toBe(true);

        service.loadMetadata().subscribe(() => {
          expect(service.hasMetadataLoadFailed()).toBe(false);
          expect(service.getIssuableCredentialTypes()).toContain('learcredential.employee');
          done();
        });
        httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockMetadata);
      });
      httpMock
        .expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA)
        .flush('Server error', { status: 503, statusText: 'Service Unavailable' });
    });
  });

  // Version selection, now the only version rule: the issuance UI policy decides WHICH
  // type+format lineages get a form, and this decides WHICH VERSION of each.
  //
  // It replaced a hardcoded global floor (`pinned-issuable-versions.ts`), which existed
  // because "the newest declared" is only the right answer while the metadata always carries
  // the current version of anything a tenant can still issue. That guarantee now comes from
  // the issuer — see the TEMPORARY note in core/models/issuance-ui-policy.model.ts.
  describe('version selection', () => {
    const metadataWith = (configIds: string[], format = 'jwt_vc_json') => ({
      credential_issuer: 'https://example.com',
      credential_configurations_supported: Object.fromEntries(
        configIds.map(configId => [
          configId,
          { format, credential_definition: { type: ['VerifiableCredential', configId] } }
        ])
      )
    });

    const flush = (metadata: object) =>
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(metadata);

    it('should offer only the newest version of a lineage, whatever the declaration order', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.employee.w3c.4', format: 'jwt_vc_json' }
        ]);
        done();
      });
      flush(metadataWith([
        'learcredential.employee.w3c.2',
        'learcredential.employee.w3c.4',
        'learcredential.employee.w3c.1'
      ]));
    });

    it('should keep every superseded version resolvable for the details screen', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.getConfigurationById('learcredential.employee.w3c.1')).toBeDefined();
        expect(Object.keys(service.getAllConfigurations() ?? {})).toContain('learcredential.employee.w3c.1');
        done();
      });
      flush(metadataWith(['learcredential.employee.w3c.1', 'learcredential.employee.w3c.4']));
    });

    it('should version each format family independently', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.employee.w3c.4', format: 'jwt_vc_json' },
          { configId: 'learcredential.employee.sd.2', format: 'dc+sd-jwt' }
        ]);
        done();
      });
      flush({
        credential_issuer: 'https://example.com',
        credential_configurations_supported: {
          'learcredential.employee.w3c.1': {
            format: 'jwt_vc_json',
            credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.1'] }
          },
          'learcredential.employee.w3c.4': {
            format: 'jwt_vc_json',
            credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.4'] }
          },
          'learcredential.employee.sd.2': {
            format: 'dc+sd-jwt',
            vct: 'learcredential.employee.sd.2'
          }
        }
      });
    });

    it('should pick up a newer version without a code change', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.employee.w3c.5', format: 'jwt_vc_json' }
        ]);
        done();
      });
      flush(metadataWith(['learcredential.employee.w3c.4', 'learcredential.employee.w3c.5']));
    });

    // Deliberate consequence of dropping the hardcoded floor: with no absolute rule left, the
    // newest DECLARED version is the one offered. It is correct while the issuer only ever
    // publishes a lineage's legacy version alongside its current one — and if that ever stops
    // holding, the fix is a version floor in the policy document, not a new hardcoded map.
    it('should offer the only declared version even when it is a superseded one', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.employee.w3c.1', format: 'jwt_vc_json' }
        ]);
        done();
      });
      flush(metadataWith(['learcredential.employee.w3c.1']));
    });
  });

  // --------------------------------------------------------------------------
  // Issuance UI policy (per tenant, published as configuration). The metadata is already
  // tenant-scoped by the issuer and everything in it is issuable THROUGH THE API; this layer
  // decides what this UI offers a form for.
  // --------------------------------------------------------------------------
  describe('issuance UI policy', () => {
    /** Lineages the published document allows, mutable per test. */
    let allowedCredentials: string[];

    const flush = (metadata: Object) =>
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(metadata);

    beforeEach(() => {
      allowedCredentials = [
        'learcredential.employee.w3c',
        'learcredential.employee.mdoc',
        'learcredential.machine.w3c'
      ];

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          CredentialIssuerMetadataService,
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: TenantService, useValue: { serverUrl: environment.server_url, getServerUrl: () => environment.server_url } },
          {
            // Stubs the SOURCE, not the rule: the matching helper is the real one, so this
            // spec cannot drift from the semantics the loader applies in production.
            provide: IssuanceUiPolicyService,
            useValue: {
              allows: (configId: string) => policyAllowsConfiguration({ allowedCredentials }, configId),
              loadFailed: () => false,
            },
          },
        ]
      });
      service = TestBed.inject(CredentialIssuerMetadataService);
      httpMock = TestBed.inject(HttpTestingController);
    });

    it('should drop a type the UI must not offer, whatever the metadata declares', (done) => {
      allowedCredentials = ['learcredential.employee.w3c', 'learcredential.employee.mdoc'];

      service.loadMetadata().subscribe(() => {
        expect(service.getIssuableCredentialTypes()).toEqual(['learcredential.employee']);
        expect(service.findConfigurationsForType('learcredential.machine')).toEqual([]);
        done();
      });
      flush(mockMetadata);
    });

    // The format is part of what is allowed, so a type can be offered in one format and
    // withheld in another.
    it('should narrow a type to the format family the policy allows', (done) => {
      allowedCredentials = ['learcredential.employee.w3c'];

      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.employee.w3c.4', format: 'jwt_vc_json' }
        ]);
        done();
      });
      flush(mockMetadata);
    });

    it('should offer nothing under an empty policy', (done) => {
      allowedCredentials = [];

      service.loadMetadata().subscribe(() => {
        expect(service.getIssuableCredentialTypes()).toEqual([]);
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([]);
        done();
      });
      flush(mockMetadata);
    });

    // The policy is an intersection, never a union: it cannot put back a configuration the
    // issuer did not advertise for this tenant.
    it('should not add a lineage the metadata does not carry', (done) => {
      allowedCredentials = [
        'learcredential.employee.w3c',
        'learcredential.employee.mdoc',
        'learcredential.machine.w3c',
        'doctorid.sd'
      ];

      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toHaveLength(2);
        expect(service.getIssuableCredentialTypes()).toEqual([
          'learcredential.employee',
          'learcredential.machine'
        ]);
        done();
      });
      flush(mockMetadata);
    });

    // Superseded versions must stay resolvable by id for the details screen, exactly as they
    // do under the version rule.
    it('should keep a filtered-out configuration resolvable by id', (done) => {
      allowedCredentials = ['learcredential.employee.w3c'];

      service.loadMetadata().subscribe(() => {
        expect(service.getConfigurationById('learcredential.machine.w3c.3')).toBeDefined();
        done();
      });
      flush(mockMetadata);
    });

    // The policy chooses the lineage, keepLatestCredentialConfigurations the version — and
    // neither can be worked around by the other.
    it('should apply the policy and the version rule together', (done) => {
      allowedCredentials = ['learcredential.employee.w3c'];

      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.employee.w3c.6', format: 'jwt_vc_json' }
        ]);
        done();
      });
      flush(mockVersionedMetadata);
    });
  });
});