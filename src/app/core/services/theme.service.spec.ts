import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslateService } from '@ngx-translate/core';
import { THEME_TIMEOUT_MS, ThemeService } from './theme.service';
import { TenantService } from './tenant.service';
import { DEFAULT_THEME } from '../theme/default-theme';

const CGCOM_URL = '/assets/tenants/cgcom/theme.json';

const CGCOM_THEME = {
  tenantDomain: 'CGCOM',
  branding: {
    name: 'CGCOM',
    primaryColor: '#ffffff',
    primaryContrastColor: '#46484C',
    secondaryColor: '#F9B000',
    secondaryContrastColor: '#46484C',
    logoUrl: '/assets/tenant/logo.png',
    logoDarkUrl: null,
    faviconUrl: '/assets/tenant/favicon.png',
  },
  content: { knowledgeBaseUrl: 'https://docs.eudistack.net', walletUrl: 'https://wallet.cgcom.demo.fikua.com' },
  i18n: { defaultLang: 'es', available: ['en', 'es'] },
};

describe('ThemeService', () => {
  let service: ThemeService;
  let http: HttpTestingController;
  let tenant: string;
  let translate: { addLangs: jest.Mock; setDefaultLang: jest.Mock; use: jest.Mock };
  let consoleError: jest.SpyInstance;

  const rootStyle = () => document.documentElement.style;
  const favicon = () => document.querySelector<HTMLLinkElement>("link[rel~='icon']")?.getAttribute('href');

  function setBrowserLanguages(languages: string[]): void {
    Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true });
  }

  beforeEach(() => {
    tenant = 'cgcom';
    translate = { addLangs: jest.fn(), setDefaultLang: jest.fn(), use: jest.fn() };
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    setBrowserLanguages(['es-ES', 'es']);
    document.documentElement.removeAttribute('style');
    document.head.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach(link => link.remove());
    document.title = '';

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: { tenant: () => tenant } },
        { provide: TranslateService, useValue: translate },
      ],
    });
    service = TestBed.inject(ThemeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    consoleError.mockRestore();
    jest.useRealTimers();
  });

  async function loadWith(body: object): Promise<void> {
    const loading = service.load();
    http.expectOne(CGCOM_URL).flush(body);
    await loading;
  }

  function expectEudistackTheme(): void {
    expect(service.snapshot).toEqual(DEFAULT_THEME);
    expect(rootStyle().getPropertyValue('--primary-color')).toBe('#0F2B5B');
    expect(document.title).toBe('EUDIStack');
    expect(favicon()).toBe('assets/favicon.svg');
  }

  describe('tenant theme (AC-02)', () => {
    it('loads the theme of the resolved tenant from the shared assets', async () => {
      await loadWith(CGCOM_THEME);

      expect(service.snapshot?.branding.name).toBe('CGCOM');
    });

    it('applies the tenant colors to :root', async () => {
      await loadWith(CGCOM_THEME);

      expect(rootStyle().getPropertyValue('--primary-color')).toBe('#ffffff');
      expect(rootStyle().getPropertyValue('--primary-contrast-color')).toBe('#46484C');
      expect(rootStyle().getPropertyValue('--secondary-color')).toBe('#F9B000');
    });

    it('sets the tab title and the favicon from the tenant folder', async () => {
      await loadWith(CGCOM_THEME);

      expect(document.title).toBe('CGCOM');
      expect(favicon()).toBe('/assets/tenants/cgcom/favicon.png');
      expect(document.querySelector("link[rel='apple-touch-icon']")?.getAttribute('href'))
        .toBe('/assets/tenants/cgcom/favicon.png');
    });

    it('exposes the logo rewritten to the tenant folder', async () => {
      await loadWith(CGCOM_THEME);

      expect(service.snapshot?.branding.logoUrl).toBe('/assets/tenants/cgcom/logo.png');
    });

    it('keeps the EUDIStack knowledge base link (P-6)', async () => {
      await loadWith(CGCOM_THEME);

      expect(service.knowledgeBaseUrl).toBe(DEFAULT_THEME.content.knowledgeBaseUrl);
    });
  });

  describe('language (AC-04)', () => {
    it('offers the tenant languages and defaults to the tenant default', async () => {
      await loadWith(CGCOM_THEME);

      expect(translate.addLangs).toHaveBeenCalledWith(['en', 'es']);
      expect(translate.setDefaultLang).toHaveBeenCalledWith('es');
    });

    it('uses the browser language when the tenant offers it', async () => {
      setBrowserLanguages(['en-GB']);

      await loadWith(CGCOM_THEME);

      expect(translate.use).toHaveBeenCalledWith('en');
    });

    it('uses the tenant default when the tenant does not offer the browser language', async () => {
      setBrowserLanguages(['ca']);

      await loadWith(CGCOM_THEME);

      expect(translate.use).toHaveBeenCalledWith('es');
    });
  });

  describe('EUDIStack theme as fallback (AC-05)', () => {
    it('applies it without any request when no tenant was resolved (EC-05)', async () => {
      tenant = '';

      await service.load();

      http.expectNone(() => true);
      expectEudistackTheme();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('applies it when the tenant has no theme (ES-01)', async () => {
      const loading = service.load();
      http.expectOne(CGCOM_URL).flush('Not found', { status: 404, statusText: 'Not Found' });
      await loading;

      expectEudistackTheme();
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0][0]).toContain('"cgcom"');
    });

    it('applies it when the server answers with a page instead of the theme (ES-01)', async () => {
      const loading = service.load();
      http.expectOne(CGCOM_URL).flush('<!doctype html><html></html>');
      await loading;

      expectEudistackTheme();
    });

    it('applies it when the theme has no branding (ES-02)', async () => {
      await loadWith({ i18n: CGCOM_THEME.i18n });

      expectEudistackTheme();
    });

    it(`applies it after ${THEME_TIMEOUT_MS} ms and ignores the late answer (ES-03)`, async () => {
      jest.useFakeTimers();

      const loading = service.load();
      const request = http.expectOne(CGCOM_URL);
      jest.advanceTimersByTime(THEME_TIMEOUT_MS);
      await loading;

      expectEudistackTheme();
      expect(request.cancelled).toBe(true);
    });

    it('waits for a theme that arrives within the time limit', async () => {
      jest.useFakeTimers();

      const loading = service.load();
      jest.advanceTimersByTime(THEME_TIMEOUT_MS - 1);
      http.expectOne(CGCOM_URL).flush(CGCOM_THEME);
      await loading;

      expect(service.snapshot?.branding.name).toBe('CGCOM');
    });

    it('still sets up the EUDIStack languages', async () => {
      tenant = '';

      await service.load();

      expect(translate.addLangs).toHaveBeenCalledWith(['en', 'es']);
      expect(translate.use).toHaveBeenCalledWith('es');
    });
  });

  it('keeps an invalid color out of CSS (EC-02, NFR-2)', async () => {
    await loadWith({ ...CGCOM_THEME, branding: { ...CGCOM_THEME.branding, primaryColor: 'red; background:url(x)' } });

    expect(rootStyle().getPropertyValue('--primary-color')).toBe('#0F2B5B');
    expect(rootStyle().getPropertyValue('--secondary-color')).toBe('#F9B000');
  });
});
