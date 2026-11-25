export interface Theme {
  branding: {
    name: string;
    primaryColor: string;
    primaryContrastColor: string;
    secondaryColor: string;
    secondaryContrastColor: string;
    logoUrl: string | null;
    /** Logo for a white background. Not shown by this portal today; kept so the paths match the other interfaces. */
    logoDarkUrl: string | null;
    faviconUrl: string | null;
  };
  content: {
    links: { label: string; url: string }[];
    footer: string | null;
    knowledgeBaseUrl: string | null;
    walletUrl: string | null;
    walletUrlTest: string | null;
    showWalletUrlTest: boolean;
  };
  i18n: {
    defaultLang: string;
    available: string[];
  };
}
