import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TenantService } from 'src/app/core/services/tenant.service';
import { AuditEventsPage, AuditPeriod } from '../models/audit-event.model';
import { AUDIT_PAGE_SIZE, AuditEventsService } from './audit-events.service';

const AUDIT_URL = 'https://sandbox.dev.eudistack.net/audit';
const EVENTS_URL = `${AUDIT_URL}/api/v1/events`;

describe('AuditEventsService', () => {
  let service: AuditEventsService;
  let http: HttpTestingController;

  const period: AuditPeriod = {
    from: new Date('2026-10-19T10:00:00.000Z'),
    to: new Date('2026-11-18T10:00:00.000Z')
  };
  const page: AuditEventsPage = { events: [], next_cursor: null };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: { auditUrl: AUDIT_URL } }
      ]
    });
    service = TestBed.inject(AuditEventsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks the audit API of the tenant, newest first, 100 at a time', () => {
    service.list(period).subscribe();

    const request = http.expectOne(req => req.url === EVENTS_URL);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBe('2026-10-19T10:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-11-18T10:00:00.000Z');
    expect(request.request.params.get('order')).toBe('desc');
    expect(request.request.params.get('limit')).toBe(String(AUDIT_PAGE_SIZE));
    expect(AUDIT_PAGE_SIZE).toBe(100);
    request.flush(page);
  });

  it('sends no cursor for the first page', () => {
    service.list(period).subscribe();

    const request = http.expectOne(req => req.url === EVENTS_URL);
    expect(request.request.params.has('cursor')).toBe(false);
    request.flush(page);
  });

  it('sends the cursor, with the very same period and order, for a next page', () => {
    service.list(period, 'c-1').subscribe();

    const request = http.expectOne(req => req.url === EVENTS_URL);
    expect(request.request.params.get('cursor')).toBe('c-1');
    expect(request.request.params.get('from')).toBe('2026-10-19T10:00:00.000Z');
    expect(request.request.params.get('order')).toBe('desc');
    request.flush(page);
  });

  it('returns the page the API answers', done => {
    const answer: AuditEventsPage = {
      events: [{
        event_id: 'e-1', event_type: 'Revocation', occurred_at: '2026-11-17T09:00:00Z',
        actor: { kind: 'System', id: 'integrator' }, resource: 'attestation:a-1', result: 'Denied', reason: 'AlreadyRevoked'
      }],
      next_cursor: 'c-2'
    };

    service.list(period).subscribe(result => {
      expect(result).toEqual(answer);
      done();
    });
    http.expectOne(req => req.url === EVENTS_URL).flush(answer);
  });

  it('lets the error of the API through, for the section to explain', done => {
    service.list(period).subscribe({
      error: err => {
        expect(err.status).toBe(429);
        expect(err.error.type).toBe('rate_limited');
        done();
      }
    });
    http.expectOne(req => req.url === EVENTS_URL)
      .flush({ type: 'rate_limited' }, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '9' } });
  });
});
