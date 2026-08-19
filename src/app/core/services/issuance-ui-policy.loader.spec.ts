import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  ISSUANCE_UI_POLICY_RETRY_BACKOFF_MS,
  ISSUANCE_UI_POLICY_RETRY_COUNT,
  ISSUANCE_UI_POLICY_TIMEOUT_MS,
  ISSUANCE_UI_POLICY_URL,
} from '../constants/issuance-ui-policy.constants';
import { IssuanceUiPolicy } from '../models/issuance-ui-policy.model';
import { loadIssuanceUiPolicy } from './issuance-ui-policy.loader';

describe('loadIssuanceUiPolicy', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const publishedDocument = {
    default: { allowedCredentials: ['learcredential.employee.w3c'] },
    tenants: { kpmg: { allowedCredentials: ['learcredential.employee.sd'] } },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify({ ignoreCancelled: true }));

  // Absolute, not relative: this app is served under /issuer/, the tenant assets at the root
  // of the distribution. A relative URL would hit the app's own bundle.
  it('reads the published document from the shared tenant assets prefix', () => {
    let resolved: IssuanceUiPolicy | null | undefined;
    loadIssuanceUiPolicy(http, 'kpmg').subscribe(policy => (resolved = policy));

    const req = httpMock.expectOne(ISSUANCE_UI_POLICY_URL);
    expect(req.request.method).toBe('GET');
    req.flush(publishedDocument);

    expect(resolved).toEqual({ allowedCredentials: ['learcredential.employee.sd'] });
  });

  it('emits null when the document says nothing usable about the tenant', () => {
    let resolved: IssuanceUiPolicy | null | undefined = undefined;
    loadIssuanceUiPolicy(http, 'kpmg').subscribe(policy => (resolved = policy));

    httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush({ tenants: {} });

    expect(resolved).toBeNull();
  });

  describe('retries', () => {
    // Fail-closed makes a transient blip expensive: it would cost the tenant its issuance
    // screen for the whole session.
    it('recovers when a later attempt succeeds', fakeAsync(() => {
      let resolved: IssuanceUiPolicy | null | undefined;
      loadIssuanceUiPolicy(http, 'kpmg').subscribe(policy => (resolved = policy));

      httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush('', { status: 500, statusText: 'err' });
      tick(ISSUANCE_UI_POLICY_RETRY_BACKOFF_MS);
      httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush(publishedDocument);

      expect(resolved).toEqual({ allowedCredentials: ['learcredential.employee.sd'] });
    }));

    it('gives up after the configured attempts and propagates the error', fakeAsync(() => {
      let errored = false;
      loadIssuanceUiPolicy(http, 'kpmg').subscribe({ error: () => (errored = true) });

      for (let attempt = 0; attempt <= ISSUANCE_UI_POLICY_RETRY_COUNT; attempt++) {
        httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush('', { status: 500, statusText: 'err' });
        tick((attempt + 1) * ISSUANCE_UI_POLICY_RETRY_BACKOFF_MS);
      }

      expect(errored).toBe(true);
    }));

    // The timeout sits before the retry, so it is a per-attempt budget rather than one
    // budget for the lot.
    it('applies the wait budget to each attempt', fakeAsync(() => {
      let errored = false;
      loadIssuanceUiPolicy(http, 'kpmg').subscribe({ error: () => (errored = true) });

      httpMock.expectOne(ISSUANCE_UI_POLICY_URL);
      tick(ISSUANCE_UI_POLICY_TIMEOUT_MS + 1);
      tick(ISSUANCE_UI_POLICY_RETRY_BACKOFF_MS);

      httpMock.expectOne(ISSUANCE_UI_POLICY_URL).flush(publishedDocument);

      expect(errored).toBe(false);
    }));
  });
});
