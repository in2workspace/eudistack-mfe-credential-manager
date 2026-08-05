import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { API_PATH } from 'src/app/core/constants/api-paths.constants';
import { TenantService } from 'src/app/core/services/tenant.service';
import { CredentialCatalogService } from './credential-catalog.service';
import { CredentialCatalogEntry } from './catalog.models';

describe('CredentialCatalogService', () => {
  let service: CredentialCatalogService;
  let httpMock: HttpTestingController;

  const url = `${environment.server_url}${API_PATH.CREDENTIAL_CATALOG}`;

  const catalog: CredentialCatalogEntry[] = [
    { credentialConfigurationId: 'learcredential.employee.w3c.4', displayName: 'LEAR Credential Employee', enabled: true },
    { credentialConfigurationId: 'learcredential.machine.w3c.3', displayName: 'learcredential.machine.w3c.3', enabled: false }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CredentialCatalogService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: { serverUrl: environment.server_url } }
      ]
    });
    service = TestBed.inject(CredentialCatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getCatalog()', () => {
    it('should GET the admin catalog endpoint built from TenantService.serverUrl (AC-01)', () => {
      let received: CredentialCatalogEntry[] | undefined;
      service.getCatalog().subscribe(entries => { received = entries; });

      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('GET');
      req.flush(catalog);

      expect(received).toEqual(catalog);
    });

    it('should propagate a 403 so the component can render the forbidden state (AC-03)', () => {
      let status: number | undefined;
      service.getCatalog().subscribe({ error: (err) => { status = err.status; } });

      httpMock.expectOne(url).flush('Tenant administrator role required', {
        status: 403, statusText: 'Forbidden'
      });

      expect(status).toBe(403);
    });

    it('should propagate a 500', () => {
      let status: number | undefined;
      service.getCatalog().subscribe({ error: (err) => { status = err.status; } });

      httpMock.expectOne(url).flush('boom', { status: 500, statusText: 'Server Error' });

      expect(status).toBe(500);
    });
  });

  describe('updateCatalog()', () => {
    it('should PUT the enabled ids as replace-all payload (AC-02)', () => {
      service.updateCatalog(['A', 'B']).subscribe();

      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ enabledConfigurationIds: ['A', 'B'] });
      req.flush(null);
    });

    it('should PUT an empty array when nothing is enabled (EC-01)', () => {
      service.updateCatalog([]).subscribe();

      const req = httpMock.expectOne(url);
      expect(req.request.body).toEqual({ enabledConfigurationIds: [] });
      req.flush(null);
    });

    it('should propagate a 400 for an unknown configuration id (EC-02)', () => {
      let status: number | undefined;
      service.updateCatalog(['nope']).subscribe({ error: (err) => { status = err.status; } });

      httpMock.expectOne(url).flush('Unknown credential configuration id(s): [nope]', {
        status: 400, statusText: 'Bad Request'
      });

      expect(status).toBe(400);
    });

    it('should propagate a 403 (ES-01)', () => {
      let status: number | undefined;
      service.updateCatalog(['A']).subscribe({ error: (err) => { status = err.status; } });

      httpMock.expectOne(url).flush('Read-only access from platform tenant', {
        status: 403, statusText: 'Forbidden'
      });

      expect(status).toBe(403);
    });
  });
});
