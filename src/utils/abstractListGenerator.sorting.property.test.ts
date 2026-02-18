import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateAbstractList } from './abstractListGenerator';
import type { ScannedFile } from './fileSystemManager';
import type { ParsedFilename } from './filenameParser';
import type { SpreadsheetRow } from './spreadsheetParser';

/**
 * Feature: offline-poster-viewer, Property 7: Abstract list is sorted by abstract ID
 *
 * Validates: Requirements 3.5
 *
 * For any generated abstract list with two or more entries, each entry's abstract ID
 * SHALL be less than or equal to the next entry's abstract ID when compared numerically.
 */

// --- Helpers ---

/**
 * Extracts the numeric portion from an abstract ID string (e.g. "ABS-42" → 42).
 * Returns Infinity for entries without a parseable abstract ID (they sort to the end).
 */
function numericId(abstractId: string | undefined): number {
  if (!abstractId) return Infinity;
  const match = abstractId.match(/ABS-(\d+)/i);
  return match ? parseInt(match[1], 10) : Infinity;
}

function extensionForType(ft: 'image' | 'pdf' | 'document'): string {
  switch (ft) {
    case 'image': return 'jpg';
    case 'pdf': return 'pdf';
    case 'document': return 'pptx';
  }
}

// --- Arbitraries ---

const absNumArb = fc.integer({ min: 1, max: 9999 });

const leadingZerosArb = fc.integer({ min: 0, max: 4 }).map((n) => '0'.repeat(n));

const fileTypeArb = fc.constantFrom<'image' | 'pdf' | 'document'>('image', 'pdf', 'document');

const letterChars = 'abcdefghijklmnopqrstuvwxyz'.split('');

const authorArb = fc
  .array(
    fc.string({ minLength: 2, maxLength: 8, unit: fc.constantFrom(...letterChars) })
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1)),
    { minLength: 1, maxLength: 3 }
  )
  .map((words) => words.join(' '));

/**
 * Generates a ScannedFile + ParsedFilename pair for a given abstract ID number.
 */
function buildEntry(
  absNum: number,
  zeros: string,
  fileType: 'image' | 'pdf' | 'document',
  author: string
): { file: ScannedFile; parsed: ParsedFilename } {
  const absId = `ABS-${zeros}${absNum}`;
  const ext = extensionForType(fileType);
  const filename = `${author} ${absId}.${ext}`;
  return {
    file: {
      name: filename,
      extension: ext,
      fileType,
      handle: {} as FileSystemFileHandle,
    },
    parsed: {
      abstractId: absId,
      author,
      title: absId,
      rawFilename: filename,
    },
  };
}

/**
 * Generates a ScannedFile + ParsedFilename pair with NO abstract ID
 * (simulates filenames that don't match the ABS-N pattern).
 */
function buildEntryWithoutAbsId(
  fileType: 'image' | 'pdf' | 'document',
  author: string
): { file: ScannedFile; parsed: ParsedFilename } {
  const ext = extensionForType(fileType);
  const filename = `${author} poster.${ext}`;
  return {
    file: {
      name: filename,
      extension: ext,
      fileType,
      handle: {} as FileSystemFileHandle,
    },
    parsed: {
      abstractId: null,
      author,
      title: `${author} poster`,
      rawFilename: filename,
    },
  };
}

describe('Property 7: Abstract list is sorted by abstract ID', () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * For any generated abstract list with two or more entries (files only, no spreadsheet),
   * each entry's numeric abstract ID SHALL be ≤ the next entry's numeric abstract ID.
   */
  it('output is sorted by abstract ID ascending (files only)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(absNumArb, { minLength: 2, maxLength: 20 }),
        fc.array(leadingZerosArb, { minLength: 20, maxLength: 20 }),
        fc.array(fileTypeArb, { minLength: 20, maxLength: 20 }),
        fc.array(authorArb, { minLength: 20, maxLength: 20 }),
        (absNums, zeros, fileTypes, authors) => {
          const files: ScannedFile[] = [];
          const parsedFilenames: ParsedFilename[] = [];

          absNums.forEach((absNum, i) => {
            const { file, parsed } = buildEntry(
              absNum,
              zeros[i % zeros.length],
              fileTypes[i % fileTypes.length],
              authors[i % authors.length]
            );
            files.push(file);
            parsedFilenames.push(parsed);
          });

          const result = generateAbstractList(files, null, parsedFilenames);

          // Verify pairwise sorting
          for (let i = 0; i < result.length - 1; i++) {
            const currentNum = numericId(result[i].abstractId);
            const nextNum = numericId(result[i + 1].abstractId);
            expect(currentNum).toBeLessThanOrEqual(nextNum);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * For any generated abstract list with files AND spreadsheet rows,
   * the sorting invariant still holds across all entries.
   */
  it('output is sorted by abstract ID ascending (files + spreadsheet)', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(absNumArb, { minLength: 3, maxLength: 15 }),
        fc.array(leadingZerosArb, { minLength: 15, maxLength: 15 }),
        fc.array(fileTypeArb, { minLength: 15, maxLength: 15 }),
        fc.array(authorArb, { minLength: 15, maxLength: 15 }),
        fc.integer({ min: 1, max: 14 }),
        (absNums, zeros, fileTypes, authors, splitPoint) => {
          const split = Math.min(splitPoint, absNums.length - 1);
          const fileIds = absNums.slice(0, split);
          const spreadsheetOnlyIds = absNums.slice(split);

          const files: ScannedFile[] = [];
          const parsedFilenames: ParsedFilename[] = [];

          fileIds.forEach((absNum, i) => {
            const { file, parsed } = buildEntry(
              absNum,
              zeros[i % zeros.length],
              fileTypes[i % fileTypes.length],
              authors[i % authors.length]
            );
            files.push(file);
            parsedFilenames.push(parsed);
          });

          const spreadsheetRows: SpreadsheetRow[] = spreadsheetOnlyIds.map((absNum) => ({
            abstractId: `ABS-${absNum}`,
            title: `Title ${absNum}`,
            author: `Author ${absNum}`,
            description: `Desc ${absNum}`,
          }));

          const result = generateAbstractList(files, spreadsheetRows, parsedFilenames);

          for (let i = 0; i < result.length - 1; i++) {
            const currentNum = numericId(result[i].abstractId);
            const nextNum = numericId(result[i + 1].abstractId);
            expect(currentNum).toBeLessThanOrEqual(nextNum);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.5**
   *
   * Entries without a parseable abstract ID sort to the end of the list.
   */
  it('entries without abstract IDs sort to the end', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(absNumArb, { minLength: 1, maxLength: 10 }),
        fc.array(leadingZerosArb, { minLength: 10, maxLength: 10 }),
        fc.array(fileTypeArb, { minLength: 10, maxLength: 10 }),
        fc.array(authorArb, { minLength: 10, maxLength: 10 }),
        fc.integer({ min: 1, max: 3 }),
        (absNums, zeros, fileTypes, authors, noIdCount) => {
          const files: ScannedFile[] = [];
          const parsedFilenames: ParsedFilename[] = [];

          // Add files with abstract IDs
          absNums.forEach((absNum, i) => {
            const { file, parsed } = buildEntry(
              absNum,
              zeros[i % zeros.length],
              fileTypes[i % fileTypes.length],
              authors[i % authors.length]
            );
            files.push(file);
            parsedFilenames.push(parsed);
          });

          // Add files without abstract IDs
          for (let j = 0; j < noIdCount; j++) {
            const { file, parsed } = buildEntryWithoutAbsId(
              fileTypes[j % fileTypes.length],
              authors[j % authors.length]
            );
            files.push(file);
            parsedFilenames.push(parsed);
          }

          const result = generateAbstractList(files, null, parsedFilenames);

          // All entries with abstract IDs should come before entries without
          const firstNoIdIndex = result.findIndex((a) => !a.abstractId || numericId(a.abstractId) === Infinity);
          if (firstNoIdIndex !== -1) {
            // Every entry after firstNoIdIndex should also have no parseable abstract ID
            for (let i = firstNoIdIndex; i < result.length; i++) {
              expect(numericId(result[i].abstractId)).toBe(Infinity);
            }
            // Every entry before firstNoIdIndex should have a valid abstract ID
            for (let i = 0; i < firstNoIdIndex; i++) {
              expect(numericId(result[i].abstractId)).toBeLessThan(Infinity);
            }
          }

          // Overall sorting invariant still holds
          for (let i = 0; i < result.length - 1; i++) {
            const currentNum = numericId(result[i].abstractId);
            const nextNum = numericId(result[i + 1].abstractId);
            expect(currentNum).toBeLessThanOrEqual(nextNum);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
