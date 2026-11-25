export interface Theme {
  branding: {
    name: string;
    primaryColor: string;
    primaryContrastColor: string;
    secondaryColor: string;
    secondaryContrastColor: string;
    logoUrl: string | null;
    /** Rewritten like the other images so the paths match the other interfaces; this portal does not show it (EUD-341, P-7). */
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
