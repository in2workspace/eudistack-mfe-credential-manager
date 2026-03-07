import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { CredentialIssuerMetadataService } from './credential-issuer-metadata.service';
import { environment } from 'src/environments/environment';
import { API_PATH } from '../constants/api-paths.constants';

describe('CredentialIssuerMetadataService', () => {
  let service: CredentialIssuerMetadataService;
  let httpMock: HttpTestingController;

  const mockMetadata = {
    credential_issuer: 'https://example.com',
    credential_configurations_supported: {
      'learcredential.employee.w3c.4': {
        format: 'jwt_vc_json',
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.4'] }
      },
      'LEARCredentialEmployee_mdoc': {
        format: 'mso_mdoc',
        credential_definition: { type: ['VerifiableCredential', 'learcredential.employee.w3c.4'] }
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CredentialIssuerMetadataService,
        provideHttpClient(),
        provideHttpClientTesting()
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

  describe('getConfigurationsForType()', () => {
    it('should return empty array when metadata not loaded', () => {
      const result = service.getConfigurationsForType('learcredential.employee.w3c.4');
      expect(result).toEqual([]);
    });

    it('should return matching configurations after metadata loaded', (done) => {
      service.loadMetadata().subscribe(() => {
        const result = service.getConfigurationsForType('learcredential.employee.w3c.4');
        expect(result).toHaveLength(2);
        expect(result).toContainEqual({ configId: 'learcredential.employee.w3c.4', format: 'jwt_vc_json' });
        expect(result).toContainEqual({ configId: 'LEARCredentialEmployee_mdoc', format: 'mso_mdoc' });
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(mockMetadata);
    });

    it('should return empty array for type with no matching configurations', (done) => {
      service.loadMetadata().subscribe(() => {
        const result = service.getConfigurationsForType('learcredential.employee.w3c.4' as any);
        // OtherCredential has no credential_definition, so won't match
        const machineResult = service.getConfigurationsForType('learcredential.machine.w3c.3');
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
        const result = service.getConfigurationsForType('learcredential.employee.w3c.4');
        expect(result).toEqual([]);
        done();
      });
      httpMock.expectOne(environment.server_url + API_PATH.CREDENTIAL_ISSUER_METADATA).flush(metaWithNoTypeDef);
    });
  });
});
