/**
 * Normalizes abstract IDs so that IDs differing only in leading zeros
 * produce the same canonical key.
 *
 * Examples:
 *   "ABS-0002" → "ABS-2"
 *   "ABS-2"    → "ABS-2"
 *   "ABS-0076" → "ABS-76"
 *
 * Returns null for strings that don't contain a valid ABS-N+ pattern.
 */
export function normalizeAbstractId(id: string): string | null {
  const match = id.match(/ABS-(\d+)/i);
  if (!match) return null;

  const numericPart = parseInt(match[1], 10);
  if (isNaN(numericPart)) return null;

  return `ABS-${numericPart}`;
}
