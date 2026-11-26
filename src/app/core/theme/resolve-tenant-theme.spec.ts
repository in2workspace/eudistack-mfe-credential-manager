import { DEFAULT_THEME } from './default-theme';
import { resolveTenantTheme } from './resolve-tenant-theme';

/** The real `tenants/cgcom/theme.json` of eudistack-platform-assets, trimmed to what the portal reads. */
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

function withBranding(branding: Record<string, unknown>): unknown {
  return { ...CGCOM_THEME, branding: { ...CGCOM_THEME.branding, ...branding } };
}

describe('resolveTenantTheme', () => {
  it('takes the brand and languages of a valid tenant theme', () => {
    const theme = resolveTenantTheme(CGCOM_THEME, 'cgcom');

    expect(theme.branding).toEqual({
      name: 'CGCOM',
      primaryColor: '#ffffff',
      primaryContrastColor: '#46484C',
      secondaryColor: '#F9B000',
      secondaryContrastColor: '#46484C',
      logoUrl: '/assets/tenants/cgcom/logo.png',
      logoDarkUrl: null,
      faviconUrl: '/assets/tenants/cgcom/favicon.png',
    });
    expect(theme.i18n).toEqual({ defaultLang: 'es', available: ['en', 'es'] });
  });

  describe('asset paths (EC-01)', () => {
    it.each([
      ['/assets/tenant/logo.png', '/assets/tenants/cgcom/logo.png'],
      ['assets/tenant/logo-dark.svg', '/assets/tenants/cgcom/logo-dark.svg'],
      ['/assets/tenants/cgcom/logo.png', '/assets/tenants/cgcom/logo.png'],
      ['https://cdn.example.org/logo.png', 'https://cdn.example.org/logo.png'],
    ])('resolves %s to %s', (input, expected) => {
      const theme = resolveTenantTheme(withBranding({ logoUrl: input, logoDarkUrl: input, faviconUrl: input }), 'cgcom');

      expect(theme.branding.logoUrl).toBe(expected);
      expect(theme.branding.logoDarkUrl).toBe(expected);
      expect(theme.branding.faviconUrl).toBe(expected);
    });

    it('falls back to the EUDIStack logo and favicon when the tenant has none', () => {
      const theme = resolveTenantTheme(withBranding({ logoUrl: null, faviconUrl: '' }), 'cgcom');

      expect(theme.branding.logoUrl).toBe(DEFAULT_THEME.branding.logoUrl);
      expect(theme.branding.faviconUrl).toBe(DEFAULT_THEME.branding.faviconUrl);
    });

    it('leaves the dark logo empty, not EUDIStack\'s, when the tenant has none', () => {
      expect(resolveTenantTheme(CGCOM_THEME, 'cgcom').branding.logoDarkUrl).toBeNull();
    });
  });

  describe('colors (EC-02)', () => {
    it.each([
      ['red; background:url(x)'],
      ['red'],
      ['#12345'],
      ['#ffffff80'],
      ['rgb(0,0,0)'],
      [42],
      [null],
    ])('replaces the invalid primary %p with EUDIStack\'s and keeps the rest', (invalid) => {
      const theme = resolveTenantTheme(withBranding({ primaryColor: invalid }), 'cgcom');

      expect(theme.branding.primaryColor).toBe(DEFAULT_THEME.branding.primaryColor);
      expect(theme.branding.secondaryColor).toBe('#F9B000');
      expect(theme.branding.primaryContrastColor).toBe('#46484C');
      expect(theme.branding.name).toBe('CGCOM');
    });

    it('expands a three-digit color to six digits', () => {
      expect(resolveTenantTheme(withBranding({ primaryContrastColor: '#fA0' }), 'cgcom').branding.primaryContrastColor)
        .toBe('#ffAA00');
    });

    it('trims surrounding spaces', () => {
      expect(resolveTenantTheme(withBranding({ secondaryColor: ' #F9B000 ' }), 'cgcom').branding.secondaryColor)
        .toBe('#F9B000');
    });
  });

  it('falls back to the EUDIStack name when the tenant name is empty', () => {
    expect(resolveTenantTheme(withBranding({ name: '  ' }), 'cgcom').branding.name).toBe('EUDIStack');
  });

  describe('languages (EC-06)', () => {
    it.each([
      ['no i18n block', undefined],
      ['available is not a list', { defaultLang: 'es', available: 'es' }],
      ['available is empty', { defaultLang: 'es', available: [] }],
      ['the default is not offered', { defaultLang: 'fr', available: ['en', 'es'] }],
      ['no default', { available: ['en', 'es'] }],
    ])('uses the EUDIStack languages when %s', (_, i18n) => {
      const theme = resolveTenantTheme({ ...CGCOM_THEME, i18n }, 'cgcom');

      expect(theme.i18n).toEqual(DEFAULT_THEME.i18n);
    });

    it('drops entries that are not language codes', () => {
      const theme = resolveTenantTheme({ ...CGCOM_THEME, i18n: { defaultLang: 'en', available: ['en', '', 7, 'ca'] } }, 'kpmg');

      expect(theme.i18n).toEqual({ defaultLang: 'en', available: ['en', 'ca'] });
    });
  });

  it('keeps the EUDIStack content whatever the tenant declares (P-6)', () => {
    const theme = resolveTenantTheme(CGCOM_THEME, 'cgcom');

    expect(theme.content).toEqual(DEFAULT_THEME.content);
  });

  describe('unusable descriptor (ES-02)', () => {
    it.each([
      ['null', null],
      ['a string', '<!doctype html>'],
      ['an array', []],
      ['no branding', { i18n: CGCOM_THEME.i18n }],
      ['branding is not an object', { branding: 'cgcom' }],
    ])('returns the EUDIStack theme for %s', (_, descriptor) => {
      expect(resolveTenantTheme(descriptor, 'cgcom')).toEqual(DEFAULT_THEME);
    });
  });

  it('never hands out the shared EUDIStack constant', () => {
    const theme = resolveTenantTheme(null, 'cgcom');
    theme.branding.name = 'changed';
    theme.i18n.available.push('fr');

    expect(DEFAULT_THEME.branding.name).toBe('EUDIStack');
    expect(DEFAULT_THEME.i18n.available).toEqual(['en', 'es']);
  });
});
