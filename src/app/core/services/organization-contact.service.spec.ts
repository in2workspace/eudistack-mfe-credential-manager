import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrganizationContactService } from './organization-contact.service';
import { OrganizationContact } from '../models/entity/organization-contact';

/**
 * Unit tests for {@link OrganizationContactService}.
 *
 * @since EUD-226 (Task 25)
 */
describe('OrganizationContactService', () => {
  let service: OrganizationContactService;
  let httpMock: HttpTestingController;

  const ORG_ID = 'org-123';
  const BASE_URL = '/api/v1/organizations';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OrganizationContactService]
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

    it('should handle 5xx server error (ES-04)', () => {
      // When
      service.fetchContact(ORG_ID).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          // Then
          expect(error.status).toBe(500);
        }
      });

      const req = httpMock.expectOne(`${BASE_URL}/${ORG_ID}/contact`);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should handle timeout (ES-05)', () => {
      // When
      service.fetchContact(ORG_ID).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          // Then
          expect(error.name).toBe('TimeoutError');
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

    it('should handle 5xx server error (ES-04)', () => {
      // When
      service.updateContact(ORG_ID, VALID_EMAIL).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          // Then
          expect(error.status).toBe(503);
        }
      });

      const req = httpMock.expectOne(`${BASE_URL}/${ORG_ID}/contact`);
      req.flush('Service unavailable', { status: 503, statusText: 'Service Unavailable' });
    });

    it('should handle timeout (ES-05)', () => {
      // When
      service.updateContact(ORG_ID, VALID_EMAIL).subscribe({
        next: () => fail('should have failed'),
        error: (error) => {
          // Then
          expect(error.name).toBe('TimeoutError');
        }
      });

      const req = httpMock.expectOne(`${BASE_URL}/${ORG_ID}/contact`);
      req.error(new ProgressEvent('timeout'), { status: 0, statusText: 'Unknown Error' });
    });
  });
});
