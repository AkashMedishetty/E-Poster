import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateAbstractList } from './abstractListGenerator';
import type { ScannedFile } from './fileSystemManager';
import type { SpreadsheetRow } from './spreadsheetParser';
import type { ParsedFilename } from './filenameParser';
import { normalizeAbstractId } from './abstractIdNormalizer';

/**
 * Feature: offline-poster-viewer, Property 4: Abstract list merge correctness
 *
 * Validates: Requirements 2.4, 2.5, 2.6
 *
 * For any set of scanned files and spreadsheet rows:
 * (a) files with matching spreadsheet rows SHALL use spreadsheet metadata,
 * (b) files without matching spreadsheet rows SHALL use filename-derived metadata, and
 * (c) spreadsheet rows without matching files SHALL appear in the result with `hasFile` set to false.
 */

// --- Arbitraries ---

const absNumArb = fc.integer({ min: 1, max: 9999 });

const letterChars = 'abcdefghijklmnopqrstuvwxyz'.split('');

const authorWordArb = fc
  .string({ minLength: 2, maxLength: 10, unit: fc.constantFrom(...letterChars) })
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1));

const authorArb = fc
  .array(authorWordArb, { minLength: 1, maxLength: 3 })
  .map((words) => words.join(' '));

const titleArb = fc
  .string({ minLength: 3, maxLength: 30, unit: fc.constantFrom(...letterChars, ' ', '0', '1', '2', '3') })
  .map((s) => s.trim())
  .filter((s) => s.length >= 3);

const descriptionArb = fc
  .string({ minLength: 0, maxLength: 40, unit: fc.constantFrom(...letterChars, ' ', '0', '1') })
  .map((s) => s.trim());

const fileTypeArb = fc.constantFrom<'image' | 'pdf' | 'document'>('image', 'pdf', 'document');

function extensionForType(ft: 'image' | 'pdf' | 'document'): string {
  switch (ft) {
    case 'image': return 'jpg';
    case 'pdf': return 'pdf';
    case 'document': return 'pptx';
  }
}

const leadingZerosArb = fc.integer({ min: 0, max: 4 }).map((n) => '0'.repeat(n));

/**
 * Generate a merge scenario with three disjoint sets of abstract ID numbers:
 * - fileOnlyIds: IDs that appear only in scanned files
 * - sharedIds: IDs that appear in both files and spreadsheet
 * - spreadsheetOnlyIds: IDs that appear only in the spreadsheet
 */
const mergeScenarioArb = fc
  .uniqueArray(absNumArb, { minLength: 2, maxLength: 12 })
  .chain((allIds) => {
    // Partition into 3 groups using two random split points
    return fc.tuple(
      fc.integer({ min: 1, max: Math.max(1, allIds.length - 1) }),
      fc.integer({ min: 0, max: Math.max(0, allIds.length - 2) })
    ).map(([split1, split2]) => {
      const sorted = [split1, split2].sort((a, b) => a - b);
      return {
        fileOnlyIds: allIds.slice(0, sorted[0]),
        sharedIds: allIds.slice(sorted[0], sorted[1] + 1),
        spreadsheetOnlyIds: allIds.slice(sorted[1] + 1),
      };
    });
  })
  .filter(({ fileOnlyIds, sharedIds, spreadsheetOnlyIds }) => {
    // Ensure at least one ID in each category for meaningful tests
    return fileOnlyIds.length + sharedIds.length + spreadsheetOnlyIds.length > 0;
  });

function buildFileEntry(
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

function buildSpreadsheetRow(
  absNum: number,
  title: string,
  author: string,
  description: string
): SpreadsheetRow {
  return { abstractId: `ABS-${absNum}`, title, author, description };
}

/**
 * Helper: builds the full test inputs from a scenario and random metadata arrays.
 */
function buildTestInputs(
  scenario: { fileOnlyIds: number[]; sharedIds: number[]; spreadsheetOnlyIds: number[] },
  fileAuthors: string[],
  ssTitles: string[],
  ssAuthors: string[],
  ssDescs: string[],
  fileTypes: ('image' | 'pdf' | 'document')[],
  zeros: string[]
) {
  const { fileOnlyIds, sharedIds, spreadsheetOnlyIds } = scenario;
  const allFileIds = [...fileOnlyIds, ...sharedIds];

  const files: ScannedFile[] = [];
  const parsedFilenames: ParsedFilename[] = [];

  allFileIds.forEach((absNum, i) => {
    const { file, parsed } = buildFileEntry(
      absNum,
      zeros[i % zeros.length],
      fileTypes[i % fileTypes.length],
      fileAuthors[i % fileAuthors.length]
    );
    files.push(file);
    parsedFilenames.push(parsed);
  });

  const spreadsheetRows: SpreadsheetRow[] = [];
  sharedIds.forEach((absNum, i) => {
    spreadsheetRows.push(
      buildSpreadsheetRow(absNum, ssTitles[i % ssTitles.length], ssAuthors[i % ssAuthors.length], ssDescs[i % ssDescs.length])
    );
  });
  spreadsheetOnlyIds.forEach((absNum, i) => {
    const offset = sharedIds.length + i;
    spreadsheetRows.push(
      buildSpreadsheetRow(absNum, ssTitles[offset % ssTitles.length], ssAuthors[offset % ssAuthors.length], ssDescs[offset % ssDescs.length])
    );
  });

  return { files, parsedFilenames, spreadsheetRows, allFileIds };
}

describe('Property 4: Abstract list merge correctness', () => {
  const metadataArbs = [
    fc.array(authorArb, { minLength: 5, maxLength: 10 }),
    fc.array(titleArb, { minLength: 5, maxLength: 10 }),
    fc.array(authorArb, { minLength: 5, maxLength: 10 }),
    fc.array(descriptionArb, { minLength: 5, maxLength: 10 }),
    fc.array(fileTypeArb, { minLength: 5, maxLength: 10 }),
    fc.array(leadingZerosArb, { minLength: 5, maxLength: 10 }),
  ] as const;

  /**
   * **Validates: Requirements 2.4**
   *
   * (a) Files with matching spreadsheet rows SHALL use spreadsheet metadata.
   */
  it('uses spreadsheet metadata for files with matching spreadsheet rows', () => {
    fc.assert(
      fc.property(
        mergeScenarioArb,
        ...metadataArbs,
        (scenario, fileAuthors, ssTitles, ssAuthors, ssDescs, fileTypes, zeros) => {
          const { files, parsedFilenames, spreadsheetRows } = buildTestInputs(
            scenario, fileAuthors, ssTitles, ssAuthors, ssDescs, fileTypes, zeros
          );

          const result = generateAbstractList(files, spreadsheetRows, parsedFilenames);

          for (const absNum of scenario.sharedIds) {
            const normalized = normalizeAbstractId(`ABS-${absNum}`);
            const entry = result.find((a) => a.abstractId === normalized);
            expect(entry).toBeDefined();
            expect(entry!.hasFile).toBe(true);

            const ssRow = spreadsheetRows.find(
              (r) => normalizeAbstractId(r.abstractId) === normalized
            );
            expect(entry!.title).toBe(ssRow!.title);
            expect(entry!.author).toBe(ssRow!.author);
            expect(entry!.description).toBe(ssRow!.description);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.5**
   *
   * (b) Files without matching spreadsheet rows SHALL use filename-derived metadata.
   */
  it('uses filename-derived metadata for files without matching spreadsheet rows', () => {
    fc.assert(
      fc.property(
        mergeScenarioArb,
        ...metadataArbs,
        (scenario, fileAuthors, ssTitles, ssAuthors, ssDescs, fileTypes, zeros) => {
          const { files, parsedFilenames, spreadsheetRows, allFileIds } = buildTestInputs(
            scenario, fileAuthors, ssTitles, ssAuthors, ssDescs, fileTypes, zeros
          );

          const result = generateAbstractList(files, spreadsheetRows, parsedFilenames);

          for (const absNum of scenario.fileOnlyIds) {
            const normalized = normalizeAbstractId(`ABS-${absNum}`);
            const entry = result.find((a) => a.abstractId === normalized);
            expect(entry).toBeDefined();
            expect(entry!.hasFile).toBe(true);

            const fileIdx = allFileIds.indexOf(absNum);
            const parsed = parsedFilenames[fileIdx];
            expect(entry!.title).toBe(parsed.title);
            expect(entry!.author).toBe(parsed.author);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.6**
   *
   * (c) Spreadsheet rows without matching files SHALL appear in the result
   * with `hasFile` set to false.
   */
  it('includes spreadsheet-only entries with hasFile set to false', () => {
    fc.assert(
      fc.property(
        mergeScenarioArb,
        ...metadataArbs,
        (scenario, fileAuthors, ssTitles, ssAuthors, ssDescs, fileTypes, zeros) => {
          const { files, parsedFilenames, spreadsheetRows } = buildTestInputs(
            scenario, fileAuthors, ssTitles, ssAuthors, ssDescs, fileTypes, zeros
          );

          const result = generateAbstractList(files, spreadsheetRows, parsedFilenames);

          for (const absNum of scenario.spreadsheetOnlyIds) {
            const normalized = normalizeAbstractId(`ABS-${absNum}`);
            const entry = result.find((a) => a.abstractId === normalized);
            expect(entry).toBeDefined();
            expect(entry!.hasFile).toBe(false);

            const ssRow = spreadsheetRows.find(
              (r) => normalizeAbstractId(r.abstractId) === normalized
            );
            expect(entry!.title).toBe(ssRow!.title);
            expect(entry!.author).toBe(ssRow!.author);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.4, 2.5, 2.6**
   *
   * The total number of entries in the result SHALL equal the union of
   * unique abstract IDs from files and spreadsheet rows.
   */
  it('result contains exactly the union of file and spreadsheet entries', () => {
    fc.assert(
      fc.property(
        mergeScenarioArb,
        ...metadataArbs,
        (scenario, fileAuthors, ssTitles, ssAuthors, ssDescs, fileTypes, zeros) => {
          const { files, parsedFilenames, spreadsheetRows, allFileIds } = buildTestInputs(
            scenario, fileAuthors, ssTitles, ssAuthors, ssDescs, fileTypes, zeros
          );

          const result = generateAbstractList(files, spreadsheetRows, parsedFilenames);

          const expectedCount =
            scenario.fileOnlyIds.length + scenario.sharedIds.length + scenario.spreadsheetOnlyIds.length;
          expect(result).toHaveLength(expectedCount);

          const fileEntries = result.filter((a) => a.hasFile === true);
          expect(fileEntries).toHaveLength(allFileIds.length);

          const noFileEntries = result.filter((a) => a.hasFile === false);
          expect(noFileEntries).toHaveLength(scenario.spreadsheetOnlyIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
