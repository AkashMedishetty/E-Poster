import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { exportAsCsv, parseCsv } from './dataExporter';
import type { CsvRow } from './dataExporter';
import type { PosterInteractions, Comment } from './interactionStore';

/**
 * Feature: offline-poster-viewer, Property 15: CSV export round-trip
 *
 * Validates: Requirements 10.6
 *
 * For any valid InteractionData object, serializing to CSV via the
 * CSV_Exporter and then parsing the CSV back SHALL produce equivalent
 * data rows with matching abstract IDs, reaction counts, comment texts,
 * timestamps, and like counts.
 */

// --- Arbitraries ---

// Comment text: no newlines (CSV uses newlines as row separators), non-empty
const commentTextArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => !s.includes('\n') && !s.includes('\r') && s.trim().length > 0);

const commentArb: fc.Arbitrary<Comment> = fc.record({
  text: commentTextArb,
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

// Abstract IDs that are safe for CSV (no commas, quotes, newlines)
const abstractIdArb = fc
  .integer({ min: 1, max: 9999 })
  .map((n) => `ABS-${n}`);

const posterInteractionsArb: fc.Arbitrary<PosterInteractions> = fc.record({
  abstractId: abstractIdArb,
  reactions: reactionsArb,
  comments: fc.array(commentArb, { minLength: 0, maxLength: 10 }),
  likes: fc.integer({ min: 0, max: 10000 }),
});

const interactionsArrayArb = fc.array(posterInteractionsArb, {
  minLength: 0,
  maxLength: 20,
});

describe('Property 15: CSV export round-trip', () => {
  /**
   * **Validates: Requirements 10.6**
   *
   * For any valid InteractionData array, serializing to CSV via exportAsCsv
   * and then parsing via parseCsv SHALL produce rows with matching abstract IDs,
   * reaction counts, comment texts, timestamps, and like counts.
   */
  it('serializing to CSV and parsing back produces equivalent data rows', () => {
    fc.assert(
      fc.property(interactionsArrayArb, (interactions) => {
        const csvString = exportAsCsv(interactions);
        const rows = parseCsv(csvString);

        // Build expected rows from the input
        const expectedRows: CsvRow[] = [];
        for (const poster of interactions) {
          // Reaction rows (only non-zero counts, which our generator guarantees min: 1)
          for (const [emoji, count] of Object.entries(poster.reactions)) {
            expectedRows.push({
              abstract_id: poster.abstractId,
              type: 'reaction',
              emoji,
              count: String(count),
              comment_text: '',
              timestamp: '',
              likes: '',
            });
          }

          // Comment rows
          for (const comment of poster.comments) {
            expectedRows.push({
              abstract_id: poster.abstractId,
              type: 'comment',
              emoji: '',
              count: '',
              comment_text: comment.text,
              timestamp: String(comment.timestamp),
              likes: '',
            });
          }

          // Likes row (only if likes > 0)
          if (poster.likes > 0) {
            expectedRows.push({
              abstract_id: poster.abstractId,
              type: 'likes',
              emoji: '',
              count: '',
              comment_text: '',
              timestamp: '',
              likes: String(poster.likes),
            });
          }
        }

        // Verify row count matches
        expect(rows).toHaveLength(expectedRows.length);

        // Verify each row matches
        for (let i = 0; i < expectedRows.length; i++) {
          const actual = rows[i];
          const expected = expectedRows[i];

          expect(actual.abstract_id).toBe(expected.abstract_id);
          expect(actual.type).toBe(expected.type);
          expect(actual.emoji).toBe(expected.emoji);
          expect(actual.count).toBe(expected.count);
          expect(actual.comment_text).toBe(expected.comment_text);
          expect(actual.timestamp).toBe(expected.timestamp);
          expect(actual.likes).toBe(expected.likes);
        }
      }),
      { numRuns: 150 },
    );
  });
});
