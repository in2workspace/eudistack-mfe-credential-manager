import { Theme } from '../models/theme.model';

/**
 * Above this relative luminance a color counts as "near white": unreadable as an accent on
 * the portal's white content. Same threshold as the issuance portal
 * (`resolve-tenant-branding.ts`).
 */
export const NEAR_WHITE_LUMINANCE = 0.9;

/**
 * Minimum contrast against white for the accent to be used on its own on the white content
 * (WCAG 2.x 1.4.11, non-text: selected controls, focus, icons).
 */
export const ON_WHITE_MIN_CONTRAST = 3;

const WHITE = '#ffffff';

/**
 * Last resort for the accent on white when neither the accent nor its contrast colour shows on
 * white, which only happens with a theme that breaks the 4.5:1 rule between a colour and its
 * contrast (EUD-353). Same value as the portal's neutral `--text-primary`.
 */
export const NEUTRAL_ON_WHITE = '#1A1A2E';

export interface AccentColors {
  /** Color of the brand inside the content: buttons, selected controls. */
  accent: string;
  /** Text and icons on top of {@link accent}. */
  accentContrast: string;
  /**
   * The accent when it shows on white; otherwise its contrast color, which is dark when the
   * theme gives every color a contrast of 4.5:1 (EUD-353); otherwise {@link NEUTRAL_ON_WHITE}.
   * Always at least 3:1 on white. Selected controls, focus, icons and accent text on the white
   * content.
   */
  accentOnWhite: string;
}

/** WCAG 2.x relative luminance of a `#RRGGBB` color, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isNearWhite(hex: string): boolean {
  return relativeLuminance(hex) > NEAR_WHITE_LUMINANCE;
}

/** WCAG 2.x contrast ratio between two `#RRGGBB` colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Accent colors for the content (EUD-341, scope items 5 and 6): the primary unless it is
 * near white, as CGCOM's `#ffffff`, which is meant as a header surface; then the secondary.
 * Each comes with its own contrast color. On white, the accent only when it reaches
 * {@link ON_WHITE_MIN_CONTRAST}; otherwise its contrast color (CGCOM: `#46484C`); and when that
 * does not reach it either (a theme with a wrong contrast colour), {@link NEUTRAL_ON_WHITE}.
 *
 * Expects colors already validated as `#RRGGBB` (`resolveTenantTheme`).
 */
export function deriveAccent(branding: Theme['branding']): AccentColors {
  const [accent, accentContrast] = isNearWhite(branding.primaryColor)
    ? [branding.secondaryColor, branding.secondaryContrastColor]
    : [branding.primaryColor, branding.primaryContrastColor];
  const showsOnWhite = (color: string) => contrastRatio(color, WHITE) >= ON_WHITE_MIN_CONTRAST;
  const accentOnWhite = [accent, accentContrast].find(showsOnWhite) ?? NEUTRAL_ON_WHITE;
  return { accent, accentContrast, accentOnWhite };
}
