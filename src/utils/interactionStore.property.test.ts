import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { addReaction, addLike, getInteractions } from './interactionStore';

/**
 * Feature: offline-poster-viewer, Property 10: Interaction counter increment
 *
 * Validates: Requirements 7.2, 9.2
 *
 * For any poster and any interaction type (reaction emoji or like),
 * calling the increment function N times SHALL result in a count of exactly N.
 */

// --- Arbitraries ---

const abstractIdArb = fc
  .integer({ min: 1, max: 9999 })
  .map((n) => `ABS-${n}`);

const emojiArb = fc.constantFrom('👍', '❤️', '🔥', '👏', '🎯');

const repeatCountArb = fc.integer({ min: 1, max: 50 });

describe('Property 10: Interaction counter increment', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /**
   * **Validates: Requirements 7.2**
   *
   * For any poster and any emoji, calling addReaction N times
   * SHALL result in a reaction count of exactly N for that emoji.
   */
  it('addReaction N times results in count of exactly N', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        emojiArb,
        repeatCountArb,
        (abstractId, emoji, n) => {
          localStorage.clear();

          for (let i = 0; i < n; i++) {
            addReaction(abstractId, emoji);
          }

          const interactions = getInteractions(abstractId);
          expect(interactions.reactions[emoji]).toBe(n);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 9.2**
   *
   * For any poster, calling addLike N times
   * SHALL result in a like count of exactly N.
   */
  it('addLike N times results in like count of exactly N', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        repeatCountArb,
        (abstractId, n) => {
          localStorage.clear();

          for (let i = 0; i < n; i++) {
            addLike(abstractId);
          }

          const interactions = getInteractions(abstractId);
          expect(interactions.likes).toBe(n);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.2, 9.2**
   *
   * For any poster with multiple emoji reactions, each emoji's count
   * SHALL independently equal the number of times it was incremented.
   */
  it('multiple emoji reactions on the same poster are tracked independently', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        fc.array(emojiArb, { minLength: 1, maxLength: 100 }),
        (abstractId, emojis) => {
          localStorage.clear();

          // Count expected occurrences
          const expectedCounts: Record<string, number> = {};
          for (const emoji of emojis) {
            expectedCounts[emoji] = (expectedCounts[emoji] || 0) + 1;
            addReaction(abstractId, emoji);
          }

          const interactions = getInteractions(abstractId);
          for (const [emoji, count] of Object.entries(expectedCounts)) {
            expect(interactions.reactions[emoji]).toBe(count);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 7.2, 9.2**
   *
   * For any poster, combining reactions and likes SHALL result in
   * each counter reflecting its own increment count independently.
   */
  it('reactions and likes increment independently on the same poster', () => {
    fc.assert(
      fc.property(
        abstractIdArb,
        emojiArb,
        repeatCountArb,
        repeatCountArb,
        (abstractId, emoji, reactionCount, likeCount) => {
          localStorage.clear();

          for (let i = 0; i < reactionCount; i++) {
            addReaction(abstractId, emoji);
          }
          for (let i = 0; i < likeCount; i++) {
            addLike(abstractId);
          }

          const interactions = getInteractions(abstractId);
          expect(interactions.reactions[emoji]).toBe(reactionCount);
          expect(interactions.likes).toBe(likeCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
