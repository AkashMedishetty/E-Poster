import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { addComment, getInteractions } from './interactionStore';

/**
 * Feature: offline-poster-viewer, Property 13: Comments are ordered reverse chronologically
 *
 * Validates: Requirements 8.4
 *
 * For any poster with two or more comments, the comment list SHALL be sorted
 * by timestamp in descending order (newest first).
 */

// --- Arbitraries ---

const abstractIdArb = fc
  .integer({ min: 1, max: 9999 })
  .map((n) => `ABS-${n}`);

/**
 * Generate non-whitespace comment text (at least one non-whitespace character).
 */
const commentTextArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

/**
 * Generate a list of 2+ comment texts to ensure the ordering property is testable.
 */
const commentListArb = fc.array(commentTextArb, { minLength: 2, maxLength: 20 });

describe('Property 13: Comments are ordered reverse chronologically', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * **Validates: Requirements 8.4**
   *
   * For any poster with two or more comments added sequentially,
   * getInteractions SHALL return comments sorted by timestamp descending.
   */
  it('comments are returned in descending timestamp order', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        commentListArb,
        (abstractId, texts) => {
          localStorage.clear();

          for (const text of texts) {
            addComment(abstractId, text);
          }

          const interactions = getInteractions(abstractId);
          const comments = interactions.comments;

          expect(comments.length).toBe(texts.length);

          // Verify descending timestamp order
          for (let i = 0; i < comments.length - 1; i++) {
            expect(comments[i].timestamp).toBeGreaterThanOrEqual(
              comments[i + 1].timestamp
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 8.4**
   *
   * For any poster with comments that have been manually stored with
   * varying timestamps, getInteractions SHALL still return them sorted
   * by timestamp descending regardless of insertion order.
   */
  it('comments with arbitrary timestamps are sorted descending on read', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        fc.array(
          fc.record({
            text: commentTextArb,
            timestamp: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (abstractId, comments) => {
          localStorage.clear();

          // Write comments directly to localStorage with arbitrary timestamps
          const key = `eposter-interactions-${abstractId}`;
          const data = {
            abstractId,
            reactions: {},
            comments,
            likes: 0,
          };
          localStorage.setItem(key, JSON.stringify(data));

          const interactions = getInteractions(abstractId);
          const result = interactions.comments;

          expect(result.length).toBe(comments.length);

          // Verify descending timestamp order
          for (let i = 0; i < result.length - 1; i++) {
            expect(result[i].timestamp).toBeGreaterThanOrEqual(
              result[i + 1].timestamp
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
