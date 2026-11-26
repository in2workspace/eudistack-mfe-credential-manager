import { Theme } from '../models/theme.model';
import { NEUTRAL_ON_WHITE, contrastRatio, deriveAccent, isNearWhite, relativeLuminance } from './brand-colors';
import { defaultTheme } from './default-theme';

function branding(overrides: Partial<Theme['branding']>): Theme['branding'] {
  return { ...defaultTheme().branding, ...overrides };
}

describe('brand colors', () => {
  describe('relativeLuminance', () => {
    it.each([
      ['#000000', 0],
      ['#ffffff', 1],
      ['#FFFFFF', 1],
    ])('is %p for %s', (hex, expected) => {
      expect(relativeLuminance(hex)).toBeCloseTo(expected, 5);
    });

    it('matches the WCAG value of a mid color', () => {
      // #F9B000: contrast 1.87:1 against white → (1.05 / 1.87) - 0.05 ≈ 0.512
      expect(relativeLuminance('#F9B000')).toBeCloseTo(0.512, 3);
    });
  });

  describe('isNearWhite', () => {
    it.each(['#ffffff', '#FAFAFA', '#F7F9FD'])('treats %s as near white', hex => {
      expect(isNearWhite(hex)).toBe(true);
    });

    it.each(['#0F2B5B', '#F9B000', '#ffd100', '#00ff94', '#E8ECF1'])('does not treat %s as near white', hex => {
      expect(isNearWhite(hex)).toBe(false);
    });
  });

  describe('contrastRatio', () => {
    it.each([
      ['#000000', '#ffffff', 21],
      ['#ffffff', '#000000', 21],
      ['#F9B000', '#ffffff', 1.87],
      ['#46484C', '#F9B000', 4.9],
      ['#46484C', '#ffffff', 9.16],
    ])('is %s on %s ≈ %p', (a, b, expected) => {
      expect(contrastRatio(a, b)).toBeCloseTo(expected, 1);
    });

    it('is 1 for the same color', () => {
      expect(contrastRatio('#0F2B5B', '#0F2B5B')).toBe(1);
    });
  });

  describe('deriveAccent', () => {
    it('uses the secondary when the primary is near white (CGCOM, EC-03)', () => {
      const accent = deriveAccent(branding({
        primaryColor: '#ffffff',
        primaryContrastColor: '#46484C',
        secondaryColor: '#F9B000',
        secondaryContrastColor: '#46484C',
      }));

      expect(accent).toEqual({ accent: '#F9B000', accentContrast: '#46484C', accentOnWhite: '#46484C' });
    });

    it('uses the primary when it is usable (KPMG, EC-04)', () => {
      const accent = deriveAccent(branding({
        primaryColor: '#00338D',
        primaryContrastColor: '#ffffff',
        secondaryColor: '#1E49E2',
        secondaryContrastColor: '#000000',
      }));

      expect(accent).toEqual({ accent: '#00338D', accentContrast: '#ffffff', accentOnWhite: '#00338D' });
    });

    it('uses the EUDIStack primary for the EUDIStack theme', () => {
      expect(deriveAccent(defaultTheme().branding))
        .toEqual({ accent: '#0F2B5B', accentContrast: '#ffffff', accentOnWhite: '#0F2B5B' });
    });

    it('keeps an accent of exactly 3:1 on white (EC-07)', () => {
      // #949494 is the lightest gray that still reaches 3:1 against white.
      expect(contrastRatio('#949494', '#ffffff')).toBeGreaterThanOrEqual(3);
      const accent = deriveAccent(branding({ primaryColor: '#949494', primaryContrastColor: '#000000' }));

      expect(accent.accentOnWhite).toBe('#949494');
    });

    it('falls back to the contrast color when a usable primary is too light for white (EC-07)', () => {
      // Light green: not near white, but under 3:1 against white.
      const accent = deriveAccent(branding({ primaryColor: '#7ED957', primaryContrastColor: '#1A1A2E' }));

      expect(accent).toEqual({ accent: '#7ED957', accentContrast: '#1A1A2E', accentOnWhite: '#1A1A2E' });
    });

    it('falls back to the neutral text colour when the contrast colour does not show on white either (EC-07)', () => {
      // Wrong theme data: a light primary with white text (1.76:1), against the 4.5:1 rule.
      const accent = deriveAccent(branding({ primaryColor: '#7ED957', primaryContrastColor: '#ffffff' }));

      expect(accent.accentOnWhite).toBe(NEUTRAL_ON_WHITE);
      expect(contrastRatio(NEUTRAL_ON_WHITE, '#ffffff')).toBeGreaterThanOrEqual(3);
    });
  });
});
