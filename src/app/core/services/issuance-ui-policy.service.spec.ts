import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_ISSUANCE_UI_POLICY,
  ISSUANCE_UI_POLICY_RETRY_COUNT,
  ISSUANCE_UI_POLICY_URL,
} from '../constants/issuance-ui-policy.constants';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { IssuanceUiPolicyService } from './issuance-ui-policy.service';
import { TenantService } from './tenant.service';
import { ToastService } from './toast.service';

describe('IssuanceUiPolicyService', () => {
  let service: IssuanceUiPolicyService;
  let httpMock: HttpTestingController;
  let tenant: string;
  let toast: { warning: jest.Mock };

  const publishedDocument = {
    default: { allowedCredentials: ['learcredential.employee.w3c', 'learcredential.machine.w3c'] },
    tenants: { kpmg: { allowedCredentials: ['learcredential.employee.sd'] } },
  };

  /**
   * Waits for the next attempt to reach the network.
   *
   * Real timers rather than `fakeAsync`: the service resolves through `async/await`, whose
   * continuations are native microtasks that `tick()` cannot flush at this TypeScript target.
   * The retry timing itself is covered in `issuance-ui-policy.loader.spec.ts` with fakeAsync,
   * where the pipeline is pure observables.
   */
  const nextAttempt = async (): Promise<TestRequest> => {
    for (let poll = 0; poll < 100; poll++) {
      const [request] = httpMock.match(ISSUANCE_UI_POLICY_URL);
      if (request) return request;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('The loader never issued the expected request');
  };

  /** Exhausts every attempt with the same transport failure. */
  const failEveryAttempt = async () => {
    for (let attempt = 0; attempt <= ISSUANCE_UI_POLICY_RETRY_COUNT; attempt++) {
      (await nextAttempt()).flush('', { status: 503, statusText: 'unavailable' });
    }
  };

  /** The notice is scoped to the session, so it must not leak between tests. */
  const configure = () => {
    TestBed.configureTestingModule({
      providers: [
        IssuanceUiPolicyService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: { tenant: () => tenant } },
        { provide: ToastService, useValue: toast },
        { provide: TranslateService, useValue: { get: (key: string) => of(`translated:${key}`) } },
      ],
    });
    service = TestBed.inject(IssuanceUiPolicyService);
    httpMock = TestBed.inject(HttpTestingController);
  };

  beforeEach(() => {
    tenant = 'kpmg';
    sessionStorage.clear();
    toast = { warning: jest.fn() };
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    configure();
  });

  afterEach(() => {
    httpMock.verify();
    jest.restoreAllMocks();
  });

  it('starts fail-closed, before load() runs', () => {
    expect(service.policy()).toEqual(DEFAULT_ISSUANCE_UI_POLICY);
    expect(service.policy().allowedCredentials).toEqual([]);
    expect(service.loadFailed()).toBe(false);
  });

  it('applies the entry published for the resolved tenant', async () => {
    const loaded = service.load();
    httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush(publishedDocument);
    await loaded;

    expect(service.policy()).toEqual({ allowedCredentials: ['learcredential.employee.sd'] });
    expect(service.loadFailed()).toBe(false);
    expect(service.allows('learcredential.employee.sd.1')).toBe(true);
    expect(service.allows('learcredential.employee.w3c.4')).toBe(false);
  });

  it('falls back to the default entry for a tenant with no override', async () => {
    tenant = 'dome';
    const loaded = service.load();
    httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush(publishedDocument);
    await loaded;

    expect(service.allows('learcredential.machine.w3c.3')).toBe(true);
    expect(service.loadFailed()).toBe(false);
  });

  // A policy that allows nothing is a configuration, not a failure: the screen must say
  // "no types" rather than "catalogue unavailable".
  it('accepts an explicitly empty policy without flagging a failure', async () => {
    const loaded = service.load();
    httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush({ tenants: { kpmg: { allowedCredentials: [] } } });
    await loaded;

    expect(service.policy()).toEqual({ allowedCredentials: [] });
    expect(service.loadFailed()).toBe(false);
  });

  // load() is called from the APP_INITIALIZER; any later caller must share that one request.
  it('memoizes the load across concurrent callers', async () => {
    const first = service.load();
    const second = service.load();

    httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush(publishedDocument);
    await Promise.all([first, second]);

    expect(service.policy()).toEqual({ allowedCredentials: ['learcredential.employee.sd'] });
  });

  it('does not re-fetch once loaded', async () => {
    const loaded = service.load();
    httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush(publishedDocument);
    await loaded;

    await service.load();

    expect(httpMock.match(ISSUANCE_UI_POLICY_URL)).toHaveLength(0);
  });

  it('recovers from a transient failure without flagging one', async () => {
    const loaded = service.load();

    (await nextAttempt()).flush('', { status: 503, statusText: 'unavailable' });
    (await nextAttempt()).flush(publishedDocument);
    await loaded;

    expect(service.loadFailed()).toBe(false);
    expect(service.policy()).toEqual({ allowedCredentials: ['learcredential.employee.sd'] });
  });

  describe('fail-closed', () => {
    // Whatever the reason, the outcome is one and the same: nothing offered, and a flag the
    // screen turns into an explanation.
    it('flags a failure and offers nothing when every attempt fails', async () => {
      const loaded = service.load();
      await failEveryAttempt();
      await loaded;

      expect(service.policy()).toEqual(DEFAULT_ISSUANCE_UI_POLICY);
      expect(service.loadFailed()).toBe(true);
      expect(service.allows('learcredential.employee.w3c.4')).toBe(false);
    });

    it.each([
      ['a malformed document', 'not an object'],
      ['a document with nothing usable for the tenant', { tenants: {} }],
      ['a document whose entries are all invalid', { default: { allowedCredentials: ['', 7] } }],
    ])('flags a failure on %s', async (_label, body) => {
      const loaded = service.load();
      httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush(body as never);
      await loaded;

      expect(service.policy()).toEqual(DEFAULT_ISSUANCE_UI_POLICY);
      expect(service.loadFailed()).toBe(true);
    });

    // The operator did not cause this and cannot fix it, so it earns one clear explanation —
    // not a generic error, and not one per page load.
    it('explains the consequence once', async () => {
      const loaded = service.load();
      await failEveryAttempt();
      await loaded;

      expect(toast.warning).toHaveBeenCalledTimes(1);
      expect(toast.warning).toHaveBeenCalledWith('translated:error.issuance_catalog_unavailable');
    });

    // Logging in is a full page reload, which is exactly where the repetition was visible.
    it('does not repeat the notice on a later page load of the same session', async () => {
      const loaded = service.load();
      await failEveryAttempt();
      await loaded;
      toast.warning.mockClear();

      TestBed.resetTestingModule();
      configure();
      const reloaded = service.load();
      await failEveryAttempt();
      await reloaded;

      expect(service.loadFailed()).toBe(true);
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('does not announce anything when the policy loads', async () => {
      const loaded = service.load();
      (await nextAttempt()).flush(publishedDocument);
      await loaded;

      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('never rejects, so the bootstrap cannot break on it', async () => {
      let rejected = false;
      const loaded = service.load().catch(() => (rejected = true));
      await failEveryAttempt();
      await loaded;

      expect(rejected).toBe(false);
    });
  });
});
