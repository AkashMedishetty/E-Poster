import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { addComment, getInteractions } from './interactionStore';

/**
 * Feature: offline-poster-viewer, Property 11: Comment storage preserves content
 *
 * Validates: Requirements 8.2
 *
 * For any poster and any non-whitespace comment text, adding the comment
 * SHALL result in the stored comment having the same text, a valid timestamp
 * (within a reasonable range of the current time), and the correct abstract ID.
 */

// --- Arbitraries ---

const abstractIdArb = fc
  .integer({ min: 1, max: 9999 })
  .map((n) => `ABS-${n}`);

/**
 * Generate non-whitespace strings: at least one non-whitespace character.
 * We use a filtered string arbitrary to ensure the text is not whitespace-only.
 */
const nonWhitespaceTextArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0);

describe('Property 11: Comment storage preserves content', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * **Validates: Requirements 8.2**
   *
   * For any poster and any non-whitespace comment text, addComment returns true
   * and the stored comment has the same text.
   */
  it('stored comment text matches the input text exactly', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        nonWhitespaceTextArb,
        (abstractId, text) => {
          localStorage.clear();

          const result = addComment(abstractId, text);
          expect(result).toBe(true);

          const interactions = getInteractions(abstractId);
          expect(interactions.comments).toHaveLength(1);
          expect(interactions.comments[0].text).toBe(text);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.2**
   *
   * For any poster and any non-whitespace comment text, the stored comment
   * SHALL have a valid timestamp within a reasonable range of the current time.
   */
  it('stored comment has a valid timestamp close to current time', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        nonWhitespaceTextArb,
        (abstractId, text) => {
          localStorage.clear();

          const before = Date.now();
          addComment(abstractId, text);
          const after = Date.now();

          const interactions = getInteractions(abstractId);
          const timestamp = interactions.comments[0].timestamp;

          expect(timestamp).toBeGreaterThanOrEqual(before);
          expect(timestamp).toBeLessThanOrEqual(after);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.2**
   *
   * For any poster and any non-whitespace comment text, the stored interactions
   * SHALL have the correct abstract ID.
   */
  it('stored interactions have the correct abstract ID', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        nonWhitespaceTextArb,
        (abstractId, text) => {
          localStorage.clear();

          addComment(abstractId, text);

          const interactions = getInteractions(abstractId);
          expect(interactions.abstractId).toBe(abstractId);
        }
      ),
      { numRuns: 100 }
    );
  });
});
