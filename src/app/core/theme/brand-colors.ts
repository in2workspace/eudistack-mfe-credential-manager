import { Theme } from '../models/theme.model';

/**
 * Above this relative luminance a color counts as "near white": unreadable as an accent on
 * the portal's white content. Same threshold as the issuance portal
 * (`resolve-tenant-branding.ts`).
 */
export const NEAR_WHITE_LUMINANCE = 0.9;

export interface AccentColors {
  /** Color of the brand inside the content: buttons, selected controls. */
  accent: string;
  /** Text and icons on top of {@link accent}. */
  accentContrast: string;
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

/**
 * Accent color for the content (EUD-341, scope item 5): the primary unless it is near
 * white, as CGCOM's `#ffffff`, which is meant as a header surface; then the secondary.
 * Each comes with its own contrast color.
 *
 * Expects colors already validated as `#RRGGBB` (`resolveTenantTheme`).
 */
export function deriveAccent(branding: Theme['branding']): AccentColors {
  return isNearWhite(branding.primaryColor)
    ? { accent: branding.secondaryColor, accentContrast: branding.secondaryContrastColor }
    : { accent: branding.primaryColor, accentContrast: branding.primaryContrastColor };
}
