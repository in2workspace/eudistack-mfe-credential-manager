import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from 'src/environments/environment';
import { API_PATH } from '../constants/api-paths.constants';
import { TenantService } from './tenant.service';
import { OrganizationContactService } from './organization-contact.service';
import { OrganizationContact } from '../models/entity/organization-contact';

/**
 * Unit tests for {@link OrganizationContactService}.
 *
 * @since EUD-226 (Task 25, rewritten to build the URL from
 * `TenantService.serverUrl` — see the service's doc for why a relative URL
 * would carry no Bearer token once the tenant feature flag is enabled)
 */
describe('OrganizationContactService', () => {
  let service: OrganizationContactService;
  let httpMock: HttpTestingController;

  const ORG_ID = 'org-123';
  const BASE_URL = `${environment.server_url}${API_PATH.ORGANIZATIONS}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OrganizationContactService,
        { provide: TenantService, useValue: { serverUrl: environment.server_url } }
      ]
    });

    service = TestBed.inject(OrganizationContactService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchContact', () => {
    it('should fetch contact successfully (AC-01)', () => {
      // Given
      const mockContact: OrganizationContact = { email: 'contact@example.com' };

      // When
      service.fetchContact(ORG_ID).subscribe(contact => {
        // Then
        expect(contact).toEqual(mockContact);
      });

      const req = httpMock.expectOne(`${BASE_URL}/${ORG_ID}/contact`);
      expect(req.request.method).toBe('GET');
      req.flush(mockContact);
    });

    it('should handle 5xx server error (ES-04)', (done) => {
      // When
      service.fetchContact(ORG_ID).subscribe({
        next: () => done(new Error('should have failed')),
        error: (error) => {
          // Then: an assertion thrown from inside an RxJS error handler never
          // reaches Jest on its own (it is swallowed by the subscriber, not
          // rethrown to the test body) — done(e) is what makes it fail loudly.
          try {
            expect(error.status).toBe(500);
            done();
          } catch (e) {
            done(e as Error);
          }
        }
      });

      const req = httpMock.expectOne(`${BASE_URL}/${ORG_ID}/contact`);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle timeout / network failure (ES-05)', (done) => {
      // When
      service.fetchContact(ORG_ID).subscribe({
        next: () => done(new Error('should have failed')),
        error: (error) => {
          // Then: Angular's HttpClient has no built-in timeout — a connection-level
          // failure (timeout, DNS, offline) always surfaces as an HttpErrorResponse
          // with status 0, never as a native TimeoutError.
          try {
            expect(error.name).toBe('HttpErrorResponse');
            expect(error.status).toBe(0);
            done();
          } catch (e) {
            done(e as Error);
          }
        }
      });

      const req = httpMock.expectOne(`${BASE_URL}/${ORG_ID}/contact`);
      // Simulate timeout by not flushing and triggering error
      req.error(new ProgressEvent('timeout'), { status: 0, statusText: 'Unknown Error' });
    });
  });

  describe('updateContact', () => {
    const VALID_EMAIL = 'new@example.com';

    it('should update contact successfully (AC-02)', () => {
      // When
      service.updateContact(ORG_ID, VALID_EMAIL).subscribe(() => {
        // Then: success, no response body expected
        expect(true).toBe(true);
      });

      const req = httpMock.expectOne(`${BASE_URL}/${ORG_ID}/contact`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ email: VALID_EMAIL });
      req.flush(null);
    });

    it('should handle 5xx server error (ES-04)', (done) => {
      // When
      service.updateContact(ORG_ID, VALID_EMAIL).subscribe({
        next: () => done(new Error('should have failed')),
        error: (error) => {
          // Then
          try {
            expect(error.status).toBe(503);
            done();
          } catch (e) {
            done(e as Error);
          }
        }
      });

      const req = httpMock.expectOne(`${BASE_URL}/${ORG_ID}/contact`);
      req.flush('Service unavailable', { status: 503, statusText: 'Service Unavailable' });
    });

    it('should handle timeout / network failure (ES-05)', (done) => {
      // When
      service.updateContact(ORG_ID, VALID_EMAIL).subscribe({
        next: () => done(new Error('should have failed')),
        error: (error) => {
          // Then: same as fetchContact — no client-side timeout() operator, so
          // this surfaces as a status-0 HttpErrorResponse, not a TimeoutError.
          try {
            expect(error.name).toBe('HttpErrorResponse');
            expect(error.status).toBe(0);
            done();
          } catch (e) {
            done(e as Error);
          }
        }
      });

      const req = httpMock.expectOne(`${BASE_URL}/${ORG_ID}/contact`);
      req.error(new ProgressEvent('timeout'), { status: 0, statusText: 'Unknown Error' });
    });
  });
});
