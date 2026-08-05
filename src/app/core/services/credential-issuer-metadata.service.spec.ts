import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CredentialIssuerMetadataService } from './credential-issuer-metadata.service';
import { environment } from 'src/environments/environment';
import { API_PATH } from '../constants/api-paths.constants';
import { TenantService } from './tenant.service';

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
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.mdoc.1'] }
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
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.sd.2'] }
      },
      'learcredential.employee.sd.1': {
        format: 'dc+sd-jwt',
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.sd.1'] }
      }
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CredentialIssuerMetadataService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: { serverUrl: environment.server_url, getServerUrl: () => environment.server_url} }
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

    it('should handle configs without credential_definition (no match)', (done) => {
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

  // TEMPORARY — delete alongside core/temporary/pinned-issuable-versions.ts.
  describe('PINNED-VERSIONS: hardcoded issuance floor', () => {
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

    it('should not offer a superseded employee version even when it is the only one declared', (done) => {
      // The case that motivates the pin: w3c.1 must stay declared for the details screen, and
      // the relative filter alone would call it "the newest" and render a radio button for it.
      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([]);
        expect(service.getIssuableCredentialTypes()).toEqual([]);
        done();
      });
      flush(metadataWith(['learcredential.employee.w3c.1']));
    });

    it('should keep a superseded version resolvable for the details screen', (done) => {
      // Same metadata as above: hidden from issuance, still resolvable by id. This is the
      // whole point of pinning instead of removing configurations from the metadata.
      service.loadMetadata().subscribe(() => {
        expect(service.getConfigurationById('learcredential.employee.w3c.1')).toBeDefined();
        expect(Object.keys(service.getAllConfigurations() ?? {})).toContain('learcredential.employee.w3c.1');
        done();
      });
      flush(metadataWith(['learcredential.employee.w3c.1']));
    });

    it('should drop only the superseded lineage, leaving the type issuable through the others', (done) => {
      service.loadMetadata().subscribe(() => {
        // sd is not pinned, so the type survives with a single (sd-jwt) format option.
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.employee.sd.1', format: 'dc+sd-jwt' }
        ]);
        expect(service.getIssuableCredentialTypes()).toEqual(['learcredential.employee']);
        done();
      });
      flush({
        credential_issuer: 'https://example.com',
        credential_configurations_supported: {
          'learcredential.employee.w3c.1': {
            format: 'jwt_vc_json',
            credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.1'] }
          },
          'learcredential.employee.sd.1': {
            format: 'dc+sd-jwt',
            credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.sd.1'] }
          }
        }
      });
    });

    it('should not let a superseded version win over the pinned one declared after it', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.employee.w3c.4', format: 'jwt_vc_json' }
        ]);
        done();
      });
      flush(metadataWith([
        'learcredential.employee.w3c.1',
        'learcredential.employee.w3c.2',
        'learcredential.employee.w3c.4'
      ]));
    });

    it('should hide the machine type below version 3 and offer it from 3 onwards', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.getIssuableCredentialTypes()).toEqual([]);

        service.loadMetadata().subscribe(() => {
          expect(service.findConfigurationsForType('learcredential.machine')).toEqual([
            { configId: 'learcredential.machine.w3c.3', format: 'jwt_vc_json' }
          ]);
          done();
        });
        flush(metadataWith(['learcredential.machine.w3c.3']));
      });
      flush(metadataWith(['learcredential.machine.w3c.2']));
    });

    it('should offer a version newer than the pinned one without a code change', (done) => {
      service.loadMetadata().subscribe(() => {
        expect(service.findConfigurationsForType('learcredential.employee')).toEqual([
          { configId: 'learcredential.employee.w3c.5', format: 'jwt_vc_json' }
        ]);
        done();
      });
      flush(metadataWith(['learcredential.employee.w3c.4', 'learcredential.employee.w3c.5']));
    });
  });
});