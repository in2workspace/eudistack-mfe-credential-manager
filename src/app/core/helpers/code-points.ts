/**
 * Length in Unicode code points, the way the Issuer counts a text: an emoji is one, where
 * `String.length` (UTF-16 units) would count it as two.
 */
export function countCodePoints(text: string): number {
  return Array.from(text).length;
}

/** The first `max` code points of the text, never cutting a surrogate pair in half. */
export function truncateToCodePoints(text: string, max: number): string {
  const codePoints = Array.from(text);
  return codePoints.length > max ? codePoints.slice(0, max).join('') : text;
}
