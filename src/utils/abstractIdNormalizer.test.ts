import { describe, it, expect } from 'vitest';
import { normalizeAbstractId } from './abstractIdNormalizer';

describe('normalizeAbstractId', () => {
  it('normalizes "ABS-0002" to "ABS-2"', () => {
    expect(normalizeAbstractId('ABS-0002')).toBe('ABS-2');
  });

  it('keeps "ABS-2" as "ABS-2"', () => {
    expect(normalizeAbstractId('ABS-2')).toBe('ABS-2');
  });

  it('normalizes "ABS-0076" to "ABS-76"', () => {
    expect(normalizeAbstractId('ABS-0076')).toBe('ABS-76');
  });

  it('normalizes "ABS-0000" to "ABS-0"', () => {
    expect(normalizeAbstractId('ABS-0000')).toBe('ABS-0');
  });

  it('handles large numbers like "ABS-99999"', () => {
    expect(normalizeAbstractId('ABS-99999')).toBe('ABS-99999');
  });

  it('is case-insensitive for the prefix', () => {
    expect(normalizeAbstractId('abs-0010')).toBe('ABS-10');
    expect(normalizeAbstractId('Abs-0010')).toBe('ABS-10');
  });

  it('returns null for strings without ABS pattern', () => {
    expect(normalizeAbstractId('hello')).toBeNull();
    expect(normalizeAbstractId('')).toBeNull();
    expect(normalizeAbstractId('POSTER-123')).toBeNull();
  });

  it('produces the same key for IDs differing only in leading zeros', () => {
    const a = normalizeAbstractId('ABS-0002');
    const b = normalizeAbstractId('ABS-2');
    const c = normalizeAbstractId('ABS-002');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('produces different keys for different numeric values', () => {
    expect(normalizeAbstractId('ABS-1')).not.toBe(normalizeAbstractId('ABS-2'));
    expect(normalizeAbstractId('ABS-10')).not.toBe(normalizeAbstractId('ABS-100'));
  });
});
