import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { normalizeAbstractId } from './abstractIdNormalizer';

/**
 * Feature: offline-poster-viewer, Property 3: Abstract ID normalization is consistent
 *
 * Validates: Requirements 2.3
 *
 * For any two abstract ID strings that differ only in leading zeros
 * (e.g., "ABS-0002" and "ABS-2"), the normalization function SHALL produce
 * the same canonical key. Conversely, for any two abstract IDs with different
 * numeric values, the normalization function SHALL produce different keys.
 */
describe('Property 3: Abstract ID normalization is consistent', () => {
  // Generator for a positive integer representing the numeric part of an abstract ID
  const numericIdArb = fc.integer({ min: 0, max: 99999 });

  // Generator for leading zeros (0 to 6 zeros prepended)
  const leadingZerosArb = fc.integer({ min: 0, max: 6 }).map((n) => '0'.repeat(n));

  /**
   * **Validates: Requirements 2.3**
   *
   * For any numeric value N and any two different amounts of leading zeros,
   * "ABS-{zeros1}{N}" and "ABS-{zeros2}{N}" normalize to the same key.
   */
  it('produces the same canonical key for IDs differing only in leading zeros', () => {
    fc.assert(
      fc.property(
        numericIdArb,
        leadingZerosArb,
        leadingZerosArb,
        (num, zeros1, zeros2) => {
          const id1 = `ABS-${zeros1}${num}`;
          const id2 = `ABS-${zeros2}${num}`;

          const normalized1 = normalizeAbstractId(id1);
          const normalized2 = normalizeAbstractId(id2);

          expect(normalized1).not.toBeNull();
          expect(normalized2).not.toBeNull();
          expect(normalized1).toBe(normalized2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   *
   * For any two distinct numeric values, normalization produces different keys.
   */
  it('produces different keys for IDs with different numeric values', () => {
    fc.assert(
      fc.property(
        numericIdArb,
        numericIdArb,
        leadingZerosArb,
        leadingZerosArb,
        (num1, num2, zeros1, zeros2) => {
          fc.pre(num1 !== num2);

          const id1 = `ABS-${zeros1}${num1}`;
          const id2 = `ABS-${zeros2}${num2}`;

          const normalized1 = normalizeAbstractId(id1);
          const normalized2 = normalizeAbstractId(id2);

          expect(normalized1).not.toBeNull();
          expect(normalized2).not.toBeNull();
          expect(normalized1).not.toBe(normalized2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   *
   * The normalized form always strips leading zeros, producing "ABS-{N}"
   * where N has no leading zeros (except for N=0 itself).
   */
  it('normalized form has no leading zeros in the numeric part', () => {
    fc.assert(
      fc.property(
        numericIdArb,
        leadingZerosArb,
        (num, zeros) => {
          const id = `ABS-${zeros}${num}`;
          const normalized = normalizeAbstractId(id);

          expect(normalized).not.toBeNull();
          expect(normalized).toBe(`ABS-${num}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.3**
   *
   * Normalization is case-insensitive: "abs-N", "Abs-N", "ABS-N" all produce
   * the same canonical key.
   */
  it('is case-insensitive for the ABS prefix', () => {
    fc.assert(
      fc.property(
        numericIdArb,
        fc.constantFrom('ABS', 'abs', 'Abs', 'aBs'),
        (num, prefix) => {
          const id = `${prefix}-${num}`;
          const normalized = normalizeAbstractId(id);

          expect(normalized).not.toBeNull();
          expect(normalized).toBe(`ABS-${num}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});
