import { countCodePoints, truncateToCodePoints } from './code-points';

const EMOJI = '\u{1F600}'; // one code point, two UTF-16 units

describe('code points', () => {
  describe('countCodePoints', () => {
    it.each([
      ['an empty text', '', 0],
      ['plain letters', 'abc', 3],
      ['an emoji, which String.length counts as two', EMOJI, 1],
      ['letters around an emoji', `a${EMOJI}b`, 3],
      ['accents', 'motivo: baja médica', 19],
    ])('counts %s', (_label: string, text: string, expected: number) => {
      expect(countCodePoints(text)).toBe(expected);
    });

    it('differs from the UTF-16 length exactly where the Issuer would not count two', () => {
      expect(EMOJI).toHaveLength(2);
      expect(countCodePoints(EMOJI)).toBe(1);
    });
  });

  describe('truncateToCodePoints', () => {
    it('keeps a text that fits', () => {
      expect(truncateToCodePoints('abc', 5)).toBe('abc');
    });

    it('keeps a text that is exactly the limit', () => {
      expect(truncateToCodePoints('abcde', 5)).toBe('abcde');
    });

    it('cuts a longer text at the limit', () => {
      expect(truncateToCodePoints('abcdefgh', 5)).toBe('abcde');
    });

    it('never cuts an emoji in half', () => {
      const text = `${'x'.repeat(279)}${EMOJI}tail`;

      const cut = truncateToCodePoints(text, 280);

      expect(countCodePoints(cut)).toBe(280);
      expect(cut.endsWith(EMOJI)).toBe(true);
    });

    it('counts an emoji as one when it fits', () => {
      expect(truncateToCodePoints(`${EMOJI}${EMOJI}${EMOJI}`, 2)).toBe(`${EMOJI}${EMOJI}`);
    });

    it('returns an empty text for a limit of zero', () => {
      expect(truncateToCodePoints('abc', 0)).toBe('');
    });
  });
});
