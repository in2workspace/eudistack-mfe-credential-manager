import { Theme } from '../models/theme.model';

/**
 * The EUDIStack theme, bundled with the portal (EUD-341, SAD §8.8).
 *
 * Applied when the tenant has no theme of its own, when its `theme.json` does not arrive
 * within the time limit, or when it is invalid; and field by field for any value the
 * tenant's theme gets wrong. Its asset paths are relative to the portal's base href, so
 * they never depend on the shared tenant assets being reachable.
 */
function buildDefaultTheme(): Theme {
  return {
    branding: {
      name: 'EUDIStack',
      primaryColor: '#0F2B5B',
      primaryContrastColor: '#ffffff',
      secondaryColor: '#00BFA6',
      secondaryContrastColor: '#ffffff',
      logoUrl: 'assets/logos/logo.svg',
      logoDarkUrl: 'assets/logos/logo-dark.svg',
      faviconUrl: 'assets/favicon.svg',
    },
    content: {
      links: [],
      footer: null,
      knowledgeBaseUrl: 'https://docs.eudistack.net/',
      walletUrl: '/wallet',
      walletUrlTest: null,
      showWalletUrlTest: false,
    },
    i18n: {
      defaultLang: 'es',
      available: ['en', 'es'],
    },
  };
}

export const DEFAULT_THEME: Readonly<Theme> =
  Object.freeze(buildDefaultTheme());

/** A fresh, mutable copy of {@link DEFAULT_THEME}, so no caller can alter the shared constant. */
export function defaultTheme(): Theme {
  return buildDefaultTheme();
}
