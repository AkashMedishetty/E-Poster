import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseFilename } from './filenameParser';

/**
 * Feature: offline-poster-viewer, Property 5: Filename parser extracts abstract ID and author
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 *
 * For any filename containing an "ABS-N+" pattern (where N is one or more digits),
 * the Filename_Parser SHALL extract the correct abstract ID. For filenames matching
 * known author patterns, the parser SHALL also extract the author name. For filenames
 * with no ABS pattern, the title SHALL be the filename without extension and author
 * SHALL be null.
 */
describe('Property 5: Filename parser extracts abstract ID and author', () => {
  // Generators
  const extensionArb = fc.constantFrom('.jpg', '.jpeg', '.png', '.pdf', '.ppt', '.pptx');

  const absIdArb = fc.integer({ min: 1, max: 99999 }).map((n) => ({
    raw: `ABS-${n}`,
    num: n,
  }));

  // Author names: mixed-case words that won't be mistaken for code prefixes
  const authorWordArb = fc
    .string({ minLength: 2, maxLength: 8, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')) })
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));

  const authorNameArb = fc
    .array(authorWordArb, { minLength: 1, maxLength: 3 })
    .map((words) => words.join(' '));

  // Safe base name: no dots, no ABS- pattern, alphanumeric + hyphens
  const safeBaseNameArb = fc
    .string({ minLength: 1, maxLength: 20, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')) })
    .filter((s) => !/ABS-\d/i.test(s) && !s.startsWith('.') && s.length > 0);

  /**
   * **Validates: Requirements 3.1**
   *
   * For any filename with an ABS-N+ pattern, the parser extracts the correct abstract ID.
   */
  it('extracts the correct abstract ID from filenames containing ABS-N+ pattern', () => {
    fc.assert(
      fc.property(
        safeBaseNameArb,
        absIdArb,
        extensionArb,
        (prefix, absId, ext) => {
          const filename = `${prefix} ${absId.raw}${ext}`;
          const result = parseFilename(filename);

          expect(result.abstractId).toBe(absId.raw);
          expect(result.rawFilename).toBe(filename);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2**
   *
   * For filenames with "AuthorName ABS-NNNN.ext" pattern, the parser extracts the author.
   */
  it('extracts author name from "Author ABS-NNNN.ext" pattern filenames', () => {
    fc.assert(
      fc.property(
        authorNameArb,
        absIdArb,
        extensionArb,
        (author, absId, ext) => {
          const filename = `${author} ${absId.raw}${ext}`;
          const result = parseFilename(filename);

          expect(result.abstractId).toBe(absId.raw);
          expect(result.author).toBe(author);
          expect(result.rawFilename).toBe(filename);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * For filenames with no ABS pattern, the title is the filename without extension
   * and author is null.
   */
  it('uses filename without extension as title and null author when no ABS pattern', () => {
    fc.assert(
      fc.property(
        safeBaseNameArb,
        extensionArb,
        (baseName, ext) => {
          const filename = `${baseName}${ext}`;
          const result = parseFilename(filename);

          expect(result.abstractId).toBeNull();
          expect(result.author).toBeNull();
          expect(result.title).toBe(baseName);
          expect(result.rawFilename).toBe(filename);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.1**
   *
   * rawFilename always preserves the original input regardless of pattern.
   */
  it('always preserves the original filename in rawFilename', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // With ABS pattern
          fc.tuple(safeBaseNameArb, absIdArb, extensionArb).map(
            ([prefix, absId, ext]) => `${prefix} ${absId.raw}${ext}`
          ),
          // Without ABS pattern
          fc.tuple(safeBaseNameArb, extensionArb).map(
            ([base, ext]) => `${base}${ext}`
          )
        ),
        (filename) => {
          const result = parseFilename(filename);
          expect(result.rawFilename).toBe(filename);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.1**
   *
   * When a filename contains multiple ABS patterns, the parser extracts the first one.
   */
  it('extracts the first ABS pattern when multiple exist', () => {
    fc.assert(
      fc.property(
        absIdArb,
        absIdArb,
        extensionArb,
        (firstAbs, secondAbs, ext) => {
          const filename = `${firstAbs.raw}-copy-${secondAbs.raw}${ext}`;
          const result = parseFilename(filename);

          expect(result.abstractId).toBe(firstAbs.raw);
        }
      ),
      { numRuns: 100 }
    );
  });
});
