import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, firstValueFrom, timeout } from 'rxjs';
import { Theme } from '../models/theme.model';
import { deriveAccent, isNearWhite } from '../theme/brand-colors';
import { defaultTheme } from '../theme/default-theme';
import { resolveTenantTheme } from '../theme/resolve-tenant-theme';
import { TenantService } from './tenant.service';

/** Same budget as the Login: past it, the portal starts with the EUDIStack theme instead of waiting. */
export const THEME_TIMEOUT_MS = 800;

/** Default semantic tokens — neutral, brand-independent colors for content areas. */
const SEMANTIC_DEFAULTS: Record<string, string> = {
  '--surface-page':         '#F5F7FA',
  '--surface-card':         '#FFFFFF',
  '--surface-muted':        '#E8ECF1',
  '--surface-faint':        '#F7F9FD',
  '--surface-subtle':       '#EDF0F6',
  '--surface-accent':       '#DDE6F6',
  '--surface-selected':     '#B6CAEC',

  '--text-primary':         '#1A1A2E',
  '--text-secondary':       '#6B7280',
  '--text-disabled':        '#9CA3AF',

  '--border-default':       '#D1D5DB',
  '--border-strong':        '#9CA3AF',

  '--action-secondary':     '#F3F4F6',
  '--action-secondary-hover': '#E5E7EB',
  '--action-secondary-text': '#374151',

  '--status-success':       '#059669',
  '--status-warning':       '#D97706',
  '--status-error':         '#DC2626',
  '--status-info':          '#2563EB',
  '--status-neutral':       '#6B7280',
  '--status-contrast':      '#FFFFFF',

  '--radius-sm':            '4px',
  '--radius-md':            '8px',
  '--radius-lg':            '16px',
  '--radius-full':          '9999px',

  '--shadow-sm':            '0 1px 2px rgba(0,0,0,0.05)',
  '--shadow-md':            '0 4px 6px rgba(0,0,0,0.07)',
  '--shadow-lg':            '0 10px 15px rgba(0,0,0,0.1)',
  '--shadow-glow':          '0 0 8px 0 #2D58A71A',
  '--shadow-bar-top':       '0 -2px 12px 0 #00000026',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly theme$ = new BehaviorSubject<Theme | null>(null);
  private readonly tenantService = inject(TenantService);

  constructor(
    private readonly http: HttpClient,
    private readonly translate: TranslateService
  ) {}

  /**
   * Loads the tenant's theme from the shared platform assets and applies it (EUD-341,
   * SAD §8.8). Never rejects: without a tenant, or when its `theme.json` is missing,
   * invalid or slower than {@link THEME_TIMEOUT_MS}, the bundled EUDIStack theme applies
   * and start-up continues.
   */
  async load(): Promise<void> {
    const theme = await this.fetchTheme();
    this.theme$.next(theme);
    this.applyTheme(theme);

    this.translate.addLangs(theme.i18n.available);
    this.translate.setDefaultLang(theme.i18n.defaultLang);

    const browserLang = this.detectBrowserLanguage(theme.i18n.available);
    this.translate.use(browserLang ?? theme.i18n.defaultLang);
  }

  private async fetchTheme(): Promise<Theme> {
    const tenant = this.tenantService.tenant();
    if (!tenant) {
      return defaultTheme();
    }
    try {
      const descriptor = await firstValueFrom(
        this.http.get<unknown>(`/assets/tenants/${tenant}/theme.json`).pipe(timeout(THEME_TIMEOUT_MS))
      );
      return resolveTenantTheme(descriptor, tenant);
    } catch (error) {
      console.error(`[ThemeService] Theme of tenant "${tenant}" not loaded; applying the EUDIStack theme`, error);
      return defaultTheme();
    }
  }

  getTheme(): Observable<Theme | null> {
    return this.theme$.asObservable();
  }

  get snapshot(): Theme | null {
    return this.theme$.value;
  }

  get tenantDomain(): string {
    return this.tenantService.tenant().toUpperCase();
  }

  get knowledgeBaseUrl(): string {
    return this.theme$.value?.content?.knowledgeBaseUrl ?? '';
  }

  private detectBrowserLanguage(available: string[]): string | undefined {
    const browserLanguages = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];

    for (const lang of browserLanguages) {
      const shortLang = lang.split('-')[0];
      if (available.includes(shortLang)) {
        return shortLang;
      }
    }
    return undefined;
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement.style;

    // ── Layer 1: Brand tokens (header/footer only) ──
    root.setProperty('--primary-color', theme.branding.primaryColor);
    root.setProperty('--primary-contrast-color', theme.branding.primaryContrastColor);

    // Brand color inside the content (EUD-341): the primary can be a near-white header surface,
    // so the accent is the primary or, then, the secondary. It reaches the content as the action
    // color (Layer 2) and, for what sits on white, as its on-white version.
    const { accent, accentContrast, accentOnWhite } = deriveAccent(theme.branding);
    root.setProperty('--brand-accent-on-white', accentOnWhite);

    // Brand zones (header, home bands, footer) are the primary: a near-white one needs a line
    // to stand apart from the white or light-grey page around it (EUD-341, P-3).
    root.setProperty('--brand-zone-border', isNearWhite(theme.branding.primaryColor)
      ? '1px solid var(--border-default, #D1D5DB)'
      : 'none');

    // ── Layer 2: Semantic tokens (content area) ──
    for (const [prop, value] of Object.entries(SEMANTIC_DEFAULTS)) {
      root.setProperty(prop, value);
    }

    // Action color = the brand accent (EUD-341, P-1): the fill of every filled button.
    root.setProperty('--action-primary', accent);
    root.setProperty('--action-primary-contrast', accentContrast);
    root.setProperty('--action-primary-hover', `color-mix(in srgb, ${accent} 85%, black)`);

    // Compute RGB channels for status colors (useful for rgba() variants)
    for (const status of ['success', 'warning', 'error', 'info', 'neutral']) {
      const hex = root.getPropertyValue(`--status-${status}`).trim();
      const statusRgb = this.hexToRgb(hex);
      if (statusRgb) {
        root.setProperty(`--status-${status}-rgb`, `${statusRgb.r} ${statusRgb.g} ${statusRgb.b}`);
      }
    }

    const actionRgb = this.hexToRgb(accent);
    if (actionRgb) {
      root.setProperty('--action-primary-rgb', `${actionRgb.r} ${actionRgb.g} ${actionRgb.b}`);
    }

    if (theme.branding.name) {
      document.title = theme.branding.name;
    }

    if (theme.branding.faviconUrl) {
      this.setFavicon(theme.branding.faviconUrl);
    }
  }

  private setFavicon(url: string): void {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
    // index.html declares the bundled SVG; a tenant favicon may be PNG or ICO, sometimes with
    // an extension that does not match. Without a type the browser decides from the file itself.
    link.removeAttribute('type');

    let appleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = url;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: Number.parseInt(result[1], 16), g: Number.parseInt(result[2], 16), b: Number.parseInt(result[3], 16) }
      : null;
  }
}
