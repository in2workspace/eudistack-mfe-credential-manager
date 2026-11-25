import { Theme } from '../models/theme.model';
import { deriveAccent, isNearWhite, relativeLuminance } from './brand-colors';
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

  describe('deriveAccent', () => {
    it('uses the secondary when the primary is near white (CGCOM, EC-03)', () => {
      const accent = deriveAccent(branding({
        primaryColor: '#ffffff',
        primaryContrastColor: '#46484C',
        secondaryColor: '#F9B000',
        secondaryContrastColor: '#46484C',
      }));

      expect(accent).toEqual({ accent: '#F9B000', accentContrast: '#46484C' });
    });

    it('uses the primary when it is usable (KPMG, EC-04)', () => {
      const accent = deriveAccent(branding({
        primaryColor: '#00338D',
        primaryContrastColor: '#ffffff',
        secondaryColor: '#1E49E2',
        secondaryContrastColor: '#000000',
      }));

      expect(accent).toEqual({ accent: '#00338D', accentContrast: '#ffffff' });
    });

    it('uses the EUDIStack primary for the EUDIStack theme', () => {
      expect(deriveAccent(defaultTheme().branding)).toEqual({ accent: '#0F2B5B', accentContrast: '#ffffff' });
    });
  });
});
