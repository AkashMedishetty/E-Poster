import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { addComment, getInteractions } from './interactionStore';

/**
 * Feature: offline-poster-viewer, Property 12: Whitespace-only comments are rejected
 *
 * Validates: Requirements 8.3
 *
 * For any string composed entirely of whitespace characters (spaces, tabs, newlines),
 * attempting to add it as a comment SHALL not change the comment list.
 */

// --- Arbitraries ---

const abstractIdArb = fc
  .integer({ min: 1, max: 9999 })
  .map((n) => `ABS-${n}`);

/**
 * Generate whitespace-only strings composed of spaces, tabs, and newlines.
 */
const whitespaceOnlyArb = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r', '\r\n'), { minLength: 1, maxLength: 50 })
  .map((chars) => chars.join(''));

describe('Property 12: Whitespace-only comments are rejected', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * For any poster and any whitespace-only string, addComment SHALL return false.
   */
  it('addComment returns false for whitespace-only text', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        whitespaceOnlyArb,
        (abstractId, text) => {
          localStorage.clear();

          const result = addComment(abstractId, text);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * For any poster and any whitespace-only string, the comment list
   * SHALL remain empty after the rejected submission.
   */
  it('comment list remains empty after whitespace-only submission', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        whitespaceOnlyArb,
        (abstractId, text) => {
          localStorage.clear();

          addComment(abstractId, text);

          const interactions = getInteractions(abstractId);
          expect(interactions.comments).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * For any poster with existing comments, submitting a whitespace-only string
   * SHALL not change the comment count.
   */
  it('existing comments are unchanged after whitespace-only submission', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        whitespaceOnlyArb,
        fc.integer({ min: 1, max: 10 }),
        (abstractId, wsText, existingCount) => {
          localStorage.clear();

          // Add some valid comments first
          for (let i = 0; i < existingCount; i++) {
            addComment(abstractId, `Valid comment ${i}`);
          }

          const before = getInteractions(abstractId).comments.length;

          // Attempt whitespace-only comment
          addComment(abstractId, wsText);

          const after = getInteractions(abstractId).comments.length;
          expect(after).toBe(before);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.3**
   *
   * The empty string SHALL also be rejected as a comment.
   */
  it('empty string is rejected as a comment', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        (abstractId) => {
          localStorage.clear();

          const result = addComment(abstractId, '');
          expect(result).toBe(false);

          const interactions = getInteractions(abstractId);
          expect(interactions.comments).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
