import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TenantService } from './tenant.service';
import { environment } from 'src/environments/environment';

describe('TenantService', () => {
  let service: TenantService;
  let httpMock: HttpTestingController;
  let originalLocation: Location;

  const setHostname = (hostname: string) => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hostname, origin: `https://${hostname}`, protocol: 'https:', port: '' },
      writable: true,
      configurable: true,
    });
  };

  beforeEach(() => {
    originalLocation = window.location;
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TenantService],
    });
    service = TestBed.inject(TenantService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  // --------------------------------------------------------------------------
  // Memoization — resolve() must fire the custom-domain.json fetch at most
  // once per instance, regardless of how many independent callers await it
  // (main.ts's APP_INITIALIZER and TenantAwareStsConfigLoader.loadConfigs()
  // both call resolve() on every page load).
  // --------------------------------------------------------------------------
  describe('resolve() memoization', () => {
    it('only fires one HTTP request even when called concurrently multiple times', async () => {
      setHostname('issuer.dome-marketplace-lcl.org');

      const p1 = service.resolve();
      const p2 = service.resolve();
      const p3 = service.resolve();

      const req = httpMock.expectOne('/assets/tenants/custom-domain.json');
      req.flush({
        domains: { 'issuer.dome-marketplace-lcl.org': { tenantId: 'dome', envId: 'lcl' } },
        tenants: { dome: { defaultEnv: 'lcl', env: { lcl: { issuer: 'https://issuer.dome-marketplace-lcl.org/issuer', verifier: 'https://verifier.dome-marketplace-lcl.org/verifier', wallet: 'https://wallet.dome-marketplace-lcl.org' } } } },
      });

      await Promise.all([p1, p2, p3]);

      expect(service.tenant()).toBe('dome');
    });

    it('reuses the cached resolution on a later call instead of re-fetching', async () => {
      setHostname('issuer.dome-marketplace-lcl.org');

      const first = service.resolve();
      const req = httpMock.expectOne('/assets/tenants/custom-domain.json');
      req.flush({
        domains: { 'issuer.dome-marketplace-lcl.org': { tenantId: 'dome', envId: 'lcl' } },
        tenants: { dome: { env: { lcl: { issuer: '', verifier: '', wallet: '' } } } },
      });
      await first;

      await service.resolve();

      httpMock.expectNone('/assets/tenants/custom-domain.json');
    });
  });

  // --------------------------------------------------------------------------
  // Retry — a transient failure on the custom-domain.json fetch must not
  // permanently leave `tenant` empty; the request is retried before giving up.
  // --------------------------------------------------------------------------
  describe('resolve() retry on transient failure', () => {
    // Real timers (not fakeAsync): retry()'s delay uses rxjs timer(), and polling
    // for the next request with a generous real-time wait is far more robust here
    // than trying to align tick() exactly with the delay schedule.
    const waitForNextRequest = async (): Promise<ReturnType<HttpTestingController['expectOne']> | null> => {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const pending = httpMock.match('/assets/tenants/custom-domain.json');
        if (pending.length > 0) return pending[0];
        await new Promise((r) => setTimeout(r, 50));
      }
      return null;
    };

    it('recovers tenant resolution if the first attempt fails but a retry succeeds', async () => {
      setHostname('issuer.dome-marketplace-lcl.org');

      const resolved = service.resolve();

      (await waitForNextRequest())!.error(new ProgressEvent('network error'));
      (await waitForNextRequest())!.flush({
        domains: { 'issuer.dome-marketplace-lcl.org': { tenantId: 'dome', envId: 'lcl' } },
        tenants: { dome: { env: { lcl: { issuer: '', verifier: '', wallet: '' } } } },
      });

      await resolved;

      expect(service.tenant()).toBe('dome');
    }, 10000);

    it('logs the error and leaves tenant empty if every retry fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      setHostname('issuer.dome-marketplace-lcl.org');

      const resolved = service.resolve();

      let drained = 0;
      let req = await waitForNextRequest();
      while (req) {
        req.error(new ProgressEvent('network error'));
        drained++;
        if (drained > 5) break; // safety net against an infinite loop if retry misbehaves
        req = await waitForNextRequest();
      }

      await resolved;

      expect(drained).toBeGreaterThanOrEqual(2); // at least one retry actually happened
      expect(service.tenant()).toBe('');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[TenantResolver] Failed to load /assets/tenants/custom-domain.json after retries',
        expect.anything()
      );

      consoleErrorSpy.mockRestore();
    }, 10000);
  });

  // --------------------------------------------------------------------------
  // Basic resolution behaviour (canonical vs. custom domain) — regression
  // coverage since this service previously had none.
  // --------------------------------------------------------------------------
  describe('basic tenant resolution', () => {
    it('resolves canonical tenants synchronously from the hostname', async () => {
      setHostname('sandbox.stg.eudistack.net');

      const resolved = service.resolve();
      expect(service.tenant()).toBe('sandbox');
      expect(service.canonical()).toBe(true);

      const req = httpMock.expectOne('/assets/tenants/custom-domain.json');
      req.flush({ domains: {}, tenants: {} });
      await resolved;
    });

    it('resolves a non-canonical custom domain from custom-domain.json', async () => {
      setHostname('issuer.dome-marketplace-lcl.org');

      const resolved = service.resolve();
      const req = httpMock.expectOne('/assets/tenants/custom-domain.json');
      req.flush({
        domains: { 'issuer.dome-marketplace-lcl.org': { tenantId: 'dome', envId: 'lcl' } },
        tenants: { dome: { env: { lcl: { issuer: 'https://issuer.dome-marketplace-lcl.org/issuer', verifier: 'https://verifier.dome-marketplace-lcl.org/verifier', wallet: 'https://wallet.dome-marketplace-lcl.org' } } } },
      });
      await resolved;

      expect(service.tenant()).toBe('dome');
      expect(service.canonical()).toBe(false);
      // environment.iam_url (a fixed test-env default) takes precedence over the
      // per-tenant verifier URL — see resolve()'s `environment.iam_url || ...` fallback.
      expect(service.iamUrl()).toBe(environment.iam_url);
    });
  });
});
