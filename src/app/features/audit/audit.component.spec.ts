import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, of, Subject, switchMap, throwError, timer } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { AuditComponent } from './audit.component';
import { toDateInputValue } from './helpers/audit-period.helpers';
import { AuditEvent, AuditEventsPage, AuditPeriod } from './models/audit-event.model';
import { AuditEventsService } from './services/audit-events.service';

const DAY_MS = 24 * 60 * 60 * 1000;
// 2026-11-18 12:30, local time.
const NOW = new Date(2026, 10, 18, 12, 30);

const event = (id: string, overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  event_id: id,
  event_type: 'IssuanceCompleted',
  occurred_at: '2026-11-17T09:00:00Z',
  organization: 'VATES-B1',
  actor: { kind: 'Person', id: 'u-1', name: 'Ana Pérez' },
  resource: `issuance:i-${id}`,
  result: 'Success',
  ...overrides
});

const page = (events: AuditEvent[], nextCursor: string | null = null): AuditEventsPage =>
  ({ events, next_cursor: nextCursor });

const problem = (type: string, status: number, headers?: Record<string, string>) =>
  new HttpErrorResponse({ status, error: { type }, headers: new HttpHeaders(headers) });

// A real HTTP error is asynchronous; one that fails on subscription inside a click handler reaches zone.js as an
// unhandled rejection before the awaiting code has attached its handler.
const failsLater = (error: HttpErrorResponse): Observable<never> =>
  timer(0).pipe(switchMap(() => throwError(() => error)));

const translations = (language: string) => jest.requireActual<Record<string, unknown>>(`src/assets/i18n/${language}.json`);

describe('AuditComponent', () => {
  let fixture: ComponentFixture<AuditComponent>;
  let auditEvents: { list: jest.Mock<Observable<AuditEventsPage>, [AuditPeriod, string?]> };
  let authService: { login: jest.Mock };

  const element = (): HTMLElement => fixture.nativeElement;
  const text = (selector: string): string => element().querySelector(selector)?.textContent ?? '';
  const rows = (): HTMLTableRowElement[] => Array.from(element().querySelectorAll('#audit-table tbody tr'));
  const button = (id: string): HTMLButtonElement => element().querySelector(`#${id}`) as HTMLButtonElement;

  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const open = async (): Promise<void> => {
    fixture = TestBed.createComponent(AuditComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await settle();
  };

  const setDates = (from: string, to: string): void => {
    [['#audit-from', from], ['#audit-to', to]].forEach(([selector, value]) => {
      const input = element().querySelector(selector) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('change'));
    });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    // Only the clock is faked: promises and Angular's own timers keep running.
    jest.useFakeTimers({
      now: NOW,
      doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
        'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance']
    });
    auditEvents = { list: jest.fn().mockReturnValue(of(page([event('e-1')]))) };
    authService = { login: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [AuditComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AuditEventsService, useValue: auditEvents },
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.nativeElement.remove();
    jest.useRealTimers();
  });

  describe('when it opens', () => {
    it('asks for the last 30 days, up to now', async () => {
      await open();

      expect(auditEvents.list).toHaveBeenCalledTimes(1);
      const [period, cursor] = auditEvents.list.mock.calls[0];
      expect(period.to).toEqual(NOW);
      expect(period.from.getTime()).toBe(NOW.getTime() - 30 * DAY_MS);
      expect(cursor).toBeUndefined();
    });

    it('shows that period in the date fields', async () => {
      await open();

      expect((element().querySelector('#audit-from') as HTMLInputElement).value)
        .toBe(toDateInputValue(new Date(NOW.getTime() - 30 * DAY_MS)));
      expect((element().querySelector('#audit-to') as HTMLInputElement).value).toBe('2026-11-18');
    });

    it('explains the limits of the period next to the fields, before any query', async () => {
      await open();

      expect(text('#audit-period-hint')).toContain('audit.period.hint');
      expect(element().querySelector('#audit-period-error')).toBeNull();
    });

    it('shows a loading state while the first page is on its way', () => {
      auditEvents.list.mockReturnValue(new Subject<AuditEventsPage>().asObservable());
      fixture = TestBed.createComponent(AuditComponent);
      fixture.detectChanges();

      expect(element().querySelector('#audit-skeleton')).not.toBeNull();
      expect(button('audit-consult-btn').disabled).toBe(true);
    });

    it('says that the queries are recorded', async () => {
      await open();

      expect(text('#audit-footer')).toContain('audit.footer');
    });
  });

  describe('the events', () => {
    it('shows moment, event, result, actor, object and organization of each one', async () => {
      await open();

      const cells = rows()[0].textContent!;
      expect(cells).toContain('audit.eventType.IssuanceCompleted');
      expect(cells).toContain('audit.result.Success');
      expect(cells).toContain('Ana Pérez');
      expect(cells).toContain('audit.actorKind.Person');
      expect(cells).toContain('audit.resourceKind.issuance');
      expect(cells).toContain('i-e-1');
      expect(cells).toContain('VATES-B1');
      expect(rows()[0].querySelector('time')?.getAttribute('datetime')).toBe('2026-11-17T09:00:00Z');
    });

    it('keeps them in the order the API sends them, newest first', async () => {
      auditEvents.list.mockReturnValue(of(page([event('new'), event('mid'), event('old')])));
      await open();

      expect(rows().map(row => row.textContent)).toEqual([
        expect.stringContaining('i-new'), expect.stringContaining('i-mid'), expect.stringContaining('i-old')
      ]);
    });

    it('shows the reason under a result that is not a success, and none for a success', async () => {
      auditEvents.list.mockReturnValue(of(page([
        event('ok'),
        event('no', { event_type: 'Revocation', result: 'Denied', reason: 'AlreadyRevoked' })
      ])));
      await open();

      expect(rows()[0].textContent).not.toContain('audit.reason.');
      expect(rows()[1].textContent).toContain('audit.reason.AlreadyRevoked');
    });

    it('shows a generic name, never the code, for an event type it does not know', async () => {
      auditEvents.list.mockReturnValue(of(page([event('x', { event_type: 'TeleportationRequested' })])));
      await open();

      expect(rows()[0].textContent).toContain('audit.eventType.unknown');
      expect(rows()[0].textContent).not.toContain('TeleportationRequested');
    });

    it('shows a dash when an event has no organization', async () => {
      auditEvents.list.mockReturnValue(of(page([event('x', { organization: undefined })])));
      await open();

      expect(rows()[0].querySelector('.audit__organization')?.textContent).toContain('—');
    });

    it('names the actor by identifier when it has no name', async () => {
      auditEvents.list.mockReturnValue(of(page([event('x', { actor: { kind: 'System', id: 'issuer-client' } })])));
      await open();

      expect(rows()[0].textContent).toContain('issuer-client');
      expect(rows()[0].textContent).toContain('audit.actorKind.System');
    });

    it('opens no detail: the rows are not links or buttons', async () => {
      await open();

      expect(rows()[0].querySelector('a, button')).toBeNull();
    });

    // AC-07: a denied revocation reads in the language of the portal, never as the catalogue code.
    describe.each([
      ['es', ['Revocación', 'Denegado', 'Ya estaba revocada']],
      ['en', ['Revocation', 'Denied', 'Already revoked']],
    ])('with the %s translations', (language, expected) => {
      it('shows the type, the result and the reason of a denied revocation by name', async () => {
        const translate = TestBed.inject(TranslateService);
        translate.setTranslation(language, translations(language));
        translate.use(language);
        auditEvents.list.mockReturnValue(of(page([
          event('r', { event_type: 'Revocation', result: 'Denied', reason: 'AlreadyRevoked' })
        ])));
        await open();

        const cells = rows()[0].textContent!;
        expected.forEach(name => expect(cells).toContain(name));
        expect(cells).not.toContain('AlreadyRevoked');
        expect(cells).not.toContain('audit.');
      });
    });
  });

  describe('without events', () => {
    beforeEach(async () => {
      auditEvents.list.mockReturnValue(of(page([])));
      await open();
    });

    it('says so, and shows no table', () => {
      expect(text('#audit-empty')).toContain('audit.empty');
      expect(element().querySelector('#audit-table')).toBeNull();
    });

    it('lets the auditor change the period', () => {
      button('audit-change-period-btn').click();

      expect(document.activeElement?.id).toBe('audit-from');
    });

    it('still says that the queries are recorded', () => {
      expect(text('#audit-footer')).toContain('audit.footer');
    });
  });

  describe('the next page', () => {
    const firstPage = page([event('e-1'), event('e-2')], 'cursor-1');

    it('is offered while the API says there are more', async () => {
      auditEvents.list.mockReturnValue(of(firstPage));
      await open();

      expect(button('audit-next-btn')).not.toBeNull();
    });

    it('is not offered on the last page', async () => {
      await open();

      expect(element().querySelector('#audit-next-btn')).toBeNull();
    });

    it('brings the older events with the cursor and the very same period, adding them to the ones shown', async () => {
      auditEvents.list
        .mockReturnValueOnce(of(firstPage))
        .mockReturnValueOnce(of(page([event('e-3')])));
      await open();

      button('audit-next-btn').click();
      await settle();

      expect(auditEvents.list).toHaveBeenCalledTimes(2);
      expect(auditEvents.list.mock.calls[1][1]).toBe('cursor-1');
      expect(auditEvents.list.mock.calls[1][0]).toBe(auditEvents.list.mock.calls[0][0]);
      expect(rows().map(row => row.textContent)).toEqual([
        expect.stringContaining('i-e-1'), expect.stringContaining('i-e-2'), expect.stringContaining('i-e-3')
      ]);
    });

    it('disappears once the last page has arrived', async () => {
      auditEvents.list
        .mockReturnValueOnce(of(firstPage))
        .mockReturnValueOnce(of(page([event('e-3')])));
      await open();

      button('audit-next-btn').click();
      await settle();

      expect(element().querySelector('#audit-next-btn')).toBeNull();
    });

    it('keeps the period of the listing even if the date fields change afterwards', async () => {
      auditEvents.list
        .mockReturnValueOnce(of(firstPage))
        .mockReturnValueOnce(of(page([event('e-3')])));
      await open();
      const firstPeriod = auditEvents.list.mock.calls[0][0];

      setDates('2026-11-01', '2026-11-05');
      button('audit-next-btn').click();
      await settle();

      expect(auditEvents.list.mock.calls[1][0]).toBe(firstPeriod);
    });

    it('is not asked twice while one is on its way', async () => {
      const pending = new Subject<AuditEventsPage>();
      auditEvents.list.mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(pending.asObservable());
      await open();

      button('audit-next-btn').click();
      fixture.detectChanges();

      expect(button('audit-next-btn').disabled).toBe(true);
      button('audit-next-btn').click();
      expect(auditEvents.list).toHaveBeenCalledTimes(2);
    });

    it('keeps the rows already shown, and the next page to retry, when the API fails', async () => {
      auditEvents.list
        .mockReturnValueOnce(of(firstPage))
        .mockReturnValueOnce(failsLater(problem('rate_limited', 429, { 'Retry-After': '3' })));
      await open();

      button('audit-next-btn').click();
      await settle();

      expect(rows()).toHaveLength(2);
      expect(button('audit-next-btn')).not.toBeNull();
      expect(text('#audit-error')).toContain('audit.error.rate_limited');
    });
  });

  describe('when the API answers an error', () => {
    // PRD EUD-331 §5, row by row.
    it.each([
      ['period_archived', 409, 'audit.error.period_archived'],
      ['BAD_REQUEST', 400, 'audit.error.bad_request'],
      ['insufficient_permission', 403, 'audit.error.no_access'],
      ['tenant_mismatch', 403, 'audit.error.no_access'],
      ['tenant_not_resolved', 403, 'audit.error.no_access'],
      ['invalid_token', 401, 'audit.error.session_expired'],
      ['authentication_error', 401, 'audit.error.session_expired'],
      ['service_unavailable', 503, 'audit.error.generic'],
    ])('shows the message of %s (status %s)', async (type, status, key) => {
      auditEvents.list.mockReturnValue(throwError(() => problem(type, status)));
      await open();

      expect(text('#audit-error')).toContain(key);
      expect(element().querySelector('#audit-table')).toBeNull();
      expect(element().querySelector('#audit-empty')).toBeNull();
    });

    it('tells how many seconds to wait when it is rate limited (AC-08)', async () => {
      const translate = TestBed.inject(TranslateService);
      translate.setTranslation('en', { audit: { error: { rate_limited: 'Try again in {{seconds}} seconds.' } } });
      translate.use('en');
      auditEvents.list.mockReturnValue(throwError(() => problem('rate_limited', 429, { 'Retry-After': '42' })));
      await open();

      expect(text('#audit-error')).toContain('Try again in 42 seconds.');
    });

    it('offers to sign in again only when the session has expired', async () => {
      auditEvents.list.mockReturnValue(throwError(() => problem('invalid_token', 401)));
      await open();

      button('audit-login-btn').click();

      expect(authService.login).toHaveBeenCalledTimes(1);
    });

    it('offers no sign-in for the other errors', async () => {
      auditEvents.list.mockReturnValue(throwError(() => problem('insufficient_permission', 403)));
      await open();

      expect(element().querySelector('#audit-login-btn')).toBeNull();
    });

    it('keeps the period chosen, and clears the message on the next query', async () => {
      auditEvents.list
        .mockReturnValueOnce(throwError(() => problem('period_archived', 409)))
        .mockReturnValueOnce(of(page([event('e-9')])));
      await open();
      setDates('2026-11-01', '2026-11-10');

      button('audit-consult-btn').click();
      await settle();

      expect((element().querySelector('#audit-from') as HTMLInputElement).value).toBe('2026-11-01');
      expect(element().querySelector('#audit-error')).toBeNull();
      expect(rows()).toHaveLength(1);
    });
  });

  describe('choosing another period', () => {
    beforeEach(open);

    it('asks from the start of the first day to the end of the last one', async () => {
      setDates('2026-11-01', '2026-11-10');

      button('audit-consult-btn').click();
      await settle();

      const [period, cursor] = auditEvents.list.mock.calls[1];
      expect(period.from).toEqual(new Date(2026, 10, 1));
      expect(period.to).toEqual(new Date(2026, 10, 11));
      expect(cursor).toBeUndefined();
    });

    it('asks up to now when the last day is today', async () => {
      setDates('2026-11-01', '2026-11-18');

      button('audit-consult-btn').click();
      await settle();

      expect(auditEvents.list.mock.calls[1][0].to).toEqual(NOW);
    });

    it('replaces the events shown with those of the new period', async () => {
      auditEvents.list.mockReturnValueOnce(of(page([event('other')])));
      setDates('2026-11-01', '2026-11-10');

      button('audit-consult-btn').click();
      await settle();

      expect(rows()).toHaveLength(1);
      expect(rows()[0].textContent).toContain('i-other');
    });

    // AC-04: the form explains it and does not query.
    it.each([
      ['a period of 40 days', '2026-10-05', '2026-11-18', 'audit.period.error.tooLong'],
      ['a period that starts 100 days ago', '2026-08-10', '2026-08-12', 'audit.period.error.tooOld'],
      ['a period that ends before it starts', '2026-11-10', '2026-11-01', 'audit.period.error.invalid'],
      ['an empty date', '', '2026-11-10', 'audit.period.error.invalid'],
    ])('refuses %s next to the field, without querying', (_name, from, to, key) => {
      setDates(from, to);

      expect(text('#audit-period-error')).toContain(key);
      expect(button('audit-consult-btn').disabled).toBe(true);
      button('audit-consult-btn').click();
      expect(auditEvents.list).toHaveBeenCalledTimes(1);
    });

    it('accepts a period of 20 days that includes events of 45 days ago', () => {
      setDates('2026-09-23', '2026-10-12');

      expect(element().querySelector('#audit-period-error')).toBeNull();
      expect(button('audit-consult-btn').disabled).toBe(false);
    });

    it('limits the date pickers to the days the API serves', () => {
      const from = element().querySelector('#audit-from') as HTMLInputElement;

      expect(from.max).toBe('2026-11-18');
      expect(from.min).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(from.min).getTime()).toBeLessThan(new Date('2026-11-18').getTime());
    });
  });
});
