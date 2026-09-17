import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { API_PATH } from '../constants/api-paths.constants';
import { TenantService } from './tenant.service';
import { CredentialCatalogService } from './credential-catalog.service';
import { CredentialCatalogEntry } from '../models/dto/credential-catalog.dto';
import { DeliveryEligibilitySnapshot } from '../models/entity/delivery-eligibility-snapshot';

describe('CredentialCatalogService', () => {
  let service: CredentialCatalogService;
  let httpMock: HttpTestingController;

  const url = `${environment.server_url}${API_PATH.CREDENTIAL_CATALOG}`;

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
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('fetchCatalog()', () => {
    it('should GET the catalogue endpoint and return the raw array', () => {
      const catalog: CredentialCatalogEntry[] = [
        { credentialConfigurationId: 'learcredential.employee.w3c.4', displayName: 'LEAR Credential Employee', enabled: true, deliveryModes: ['direct', 'ui'] }
      ];
      let received: CredentialCatalogEntry[] | undefined;
      service.fetchCatalog().subscribe(entries => { received = entries; });

      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('GET');
      req.flush(catalog);

      expect(received).toEqual(catalog);
    });
  });

  describe('loadDeliveryEligibility()', () => {
    it('is a second projection of the same GET, not a second request', () => {
      let snapshot: DeliveryEligibilitySnapshot | undefined;
      service.loadDeliveryEligibility().subscribe(result => { snapshot = result; });

      httpMock.expectOne(url).flush([
        { credentialConfigurationId: 'learcredential.employee.w3c.4', displayName: 'x', enabled: true, deliveryModes: ['direct'] }
      ]);

      expect(snapshot?.status).toBe('read');
    });

    it('state 1: a non-empty deliveryModes array resolves literally (EC-06)', () => {
      let snapshot: DeliveryEligibilitySnapshot | undefined;
      service.loadDeliveryEligibility().subscribe(result => { snapshot = result; });

      httpMock.expectOne(url).flush([
        { credentialConfigurationId: 'learcredential.employee.w3c.4', displayName: 'x', enabled: true, deliveryModes: ['direct', 'ui', 'email'] }
      ]);

      expect(snapshot).toEqual({
        status: 'read',
        modesByConfigId: new Map([['learcredential.employee.w3c.4', ['direct', 'ui', 'email']]])
      });
    });

    it('state 2: a missing deliveryModes field degrades silently, no warning (EC-10)', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      let snapshot: DeliveryEligibilitySnapshot | undefined;
      service.loadDeliveryEligibility().subscribe(result => { snapshot = result; });

      httpMock.expectOne(url).flush([
        { credentialConfigurationId: 'learcredential.employee.w3c.4', displayName: 'x', enabled: true }
      ]);

      expect(snapshot).toEqual({ status: 'read', modesByConfigId: new Map() });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('state 3: an empty deliveryModes array warns exactly once, naming the configId', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      let snapshot: DeliveryEligibilitySnapshot | undefined;
      service.loadDeliveryEligibility().subscribe(result => { snapshot = result; });

      httpMock.expectOne(url).flush([
        { credentialConfigurationId: 'learcredential.employee.w3c.4', displayName: 'x', enabled: true, deliveryModes: [] }
      ]);

      expect(snapshot).toEqual({
        status: 'read',
        modesByConfigId: new Map([['learcredential.employee.w3c.4', []]])
      });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      // configId is passed as its own argument (log-injection hardening, TD-5), not interpolated
      // into the message string.
      expect(warnSpy.mock.calls[0][1]).toBe('learcredential.employee.w3c.4');
    });

    it('a disabled entry with an empty deliveryModes array does not warn', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      let snapshot: DeliveryEligibilitySnapshot | undefined;
      service.loadDeliveryEligibility().subscribe(result => { snapshot = result; });

      httpMock.expectOne(url).flush([
        { credentialConfigurationId: 'learcredential.employee.w3c.4', displayName: 'x', enabled: false, deliveryModes: [] }
      ]);

      expect(snapshot).toEqual({ status: 'read', modesByConfigId: new Map() });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['a network error', () => httpMock.expectOne(url).error(new ProgressEvent('error'))],
      ['a 5xx', () => httpMock.expectOne(url).flush('boom', { status: 500, statusText: 'Server Error' })],
      ['a 404 credential_catalog_not_configured', () => httpMock.expectOne(url).flush(
        { type: 'credential_catalog_not_configured' }, { status: 404, statusText: 'Not Found' }
      )],
    ])('state 4: %s degrades to unreadable, never throws (ES-08)', (_label, triggerFailure) => {
      let snapshot: DeliveryEligibilitySnapshot | undefined;
      let errored = false;
      service.loadDeliveryEligibility().subscribe({
        next: result => { snapshot = result; },
        error: () => { errored = true; }
      });

      triggerFailure();

      expect(errored).toBe(false);
      expect(snapshot).toEqual({ status: 'unreadable' });
    });

    it('state 4: a read exceeding the timeout degrades to unreadable (ES-08)', fakeAsync(() => {
      let snapshot: DeliveryEligibilitySnapshot | undefined;
      service.loadDeliveryEligibility().subscribe(result => { snapshot = result; });

      httpMock.expectOne(url);
      tick(30_001);
      // RxJS `timeout()` unsubscribes from the still-pending request, which HttpClientTestingModule
      // reports as cancelled rather than leaving it flushable -- there is nothing left to flush,
      // only the timeout's own error to observe on the snapshot below.

      expect(snapshot).toEqual({ status: 'unreadable' });
    }));
  });
});
