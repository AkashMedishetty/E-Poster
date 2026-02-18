import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { exportAsJson } from './dataExporter';
import type { InteractionExport } from './dataExporter';
import type { PosterInteractions, Comment } from './interactionStore';

/**
 * Feature: offline-poster-viewer, Property 14: JSON export round-trip
 *
 * Validates: Requirements 10.5
 *
 * For any valid InteractionData object, serializing to JSON via the
 * JSON_Exporter and then deserializing SHALL produce an equivalent
 * InteractionData object.
 */

// --- Arbitraries ---

const commentArb: fc.Arbitrary<Comment> = fc.record({
  text: fc.string({ minLength: 1, maxLength: 200 }),
  timestamp: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
});

const reactionsArb: fc.Arbitrary<Record<string, number>> = fc
  .uniqueArray(fc.constantFrom('👍', '❤️', '🔥', '👏', '🎯'), {
    minLength: 0,
    maxLength: 5,
  })
  .chain((emojis) =>
    fc.tuple(...emojis.map(() => fc.integer({ min: 1, max: 1000 }))).map(
      (counts) => {
        const record: Record<string, number> = {};
        emojis.forEach((emoji, i) => {
          record[emoji] = counts[i];
        });
        return record;
      }
    )
  );

const posterInteractionsArb: fc.Arbitrary<PosterInteractions> = fc.record({
  abstractId: fc.integer({ min: 1, max: 9999 }).map((n) => `ABS-${n}`),
  reactions: reactionsArb,
  comments: fc.array(commentArb, { minLength: 0, maxLength: 10 }),
  likes: fc.integer({ min: 0, max: 10000 }),
});

const interactionsArrayArb = fc.array(posterInteractionsArb, {
  minLength: 0,
  maxLength: 20,
});

describe('Property 14: JSON export round-trip', () => {
  /**
   * **Validates: Requirements 10.5**
   *
   * For any valid InteractionData array, serializing to JSON via exportAsJson
   * and then JSON.parse SHALL produce an object whose posters array is
   * equivalent to the original input.
   */
  it('serializing to JSON and deserializing produces equivalent InteractionData', () => {
    fc.assert(
      fc.property(interactionsArrayArb, (interactions) => {
        const jsonString = exportAsJson(interactions);
        const parsed: InteractionExport = JSON.parse(jsonString);

        // Verify wrapper metadata
        expect(parsed.totalPosters).toBe(interactions.length);
        expect(typeof parsed.exportedAt).toBe('string');
        expect(() => new Date(parsed.exportedAt)).not.toThrow();

        // Verify round-trip equivalence of poster data
        expect(parsed.posters).toHaveLength(interactions.length);

        for (let i = 0; i < interactions.length; i++) {
          const original = interactions[i];
          const restored = parsed.posters[i];

          expect(restored.abstractId).toBe(original.abstractId);
          expect(restored.likes).toBe(original.likes);
          expect(restored.reactions).toEqual(original.reactions);
          expect(restored.comments).toHaveLength(original.comments.length);

          for (let j = 0; j < original.comments.length; j++) {
            expect(restored.comments[j].text).toBe(original.comments[j].text);
            expect(restored.comments[j].timestamp).toBe(
              original.comments[j].timestamp
            );
          }
        }
      }),
      { numRuns: 150 }
    );
  });

  /**
   * **Validates: Requirements 10.5**
   *
   * The JSON output SHALL be valid JSON (parseable without error).
   */
  it('exportAsJson always produces valid JSON', () => {
    fc.assert(
      fc.property(interactionsArrayArb, (interactions) => {
        const jsonString = exportAsJson(interactions);
        expect(() => JSON.parse(jsonString)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});
