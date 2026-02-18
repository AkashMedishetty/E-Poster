import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as XLSX from 'xlsx';
import { parseSpreadsheet } from './spreadsheetParser';

/**
 * Feature: offline-poster-viewer, Property 2: Spreadsheet parsing extracts all data rows
 *
 * Validates: Requirements 2.2
 *
 * For any valid Excel or CSV file with a header row and N data rows containing
 * abstract ID, title, author, and description columns, the Spreadsheet_Parser
 * SHALL return exactly N SpreadsheetRow objects with the correct field values.
 */

/**
 * Helper: create a File from a 2D array (first row = headers) using xlsx.
 */
function createXlsxFile(data: string[][]): File {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generator for a positive integer used as the numeric part of an abstract ID.
 * We use min: 1 to ensure non-empty abstract IDs after normalization.
 */
const absNumArb = fc.integer({ min: 1, max: 9999 });

/**
 * Generator for leading zeros (0 to 4 zeros prepended).
 */
const leadingZerosArb = fc.integer({ min: 0, max: 4 }).map((n) => '0'.repeat(n));

/**
 * Generator for an abstract ID string like "ABS-0042" or "ABS-7".
 * Always non-empty and matches the ABS-N pattern so rows won't be filtered out.
 */
const abstractIdArb = fc
  .tuple(leadingZerosArb, absNumArb)
  .map(([zeros, num]) => `ABS-${zeros}${num}`);

/**
 * Generator for safe cell text: printable ASCII, no control chars, trimmed non-empty.
 */
const cellTextArb = fc
  .string({
    minLength: 1,
    maxLength: 40,
    unit: fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,;:!?-_()'.split(
        ''
      )
    ),
  })
  .filter((s) => s.trim().length > 0);

/**
 * Generator for a single data row: [abstractId, title, author, description].
 */
const dataRowArb = fc.tuple(abstractIdArb, cellTextArb, cellTextArb, cellTextArb);

/**
 * Generator for a list of data rows with unique abstract IDs.
 * We use uniqueArray on the numeric part to avoid duplicate IDs.
 */
const dataRowsArb = fc
  .uniqueArray(absNumArb, { minLength: 1, maxLength: 15 })
  .chain((nums) =>
    fc.tuple(
      ...nums.map((num) =>
        fc.tuple(
          leadingZerosArb.map((zeros) => `ABS-${zeros}${num}`),
          cellTextArb,
          cellTextArb,
          cellTextArb
        )
      )
    )
  );

describe('Property 2: Spreadsheet parsing extracts all data rows', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any N data rows with non-empty abstract IDs, parseSpreadsheet returns
   * exactly N SpreadsheetRow objects.
   */
  it('returns exactly N rows for N data rows with valid abstract IDs', () => {
    fc.assert(
      fc.asyncProperty(dataRowsArb, async (rows) => {
        const header = ['Abstract ID', 'Title', 'Author', 'Description'];
        const data = [header, ...rows.map(([id, title, author, desc]) => [id, title, author, desc])];
        const file = createXlsxFile(data);

        const result = await parseSpreadsheet(file);

        expect(result).toHaveLength(rows.length);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2**
   *
   * For any data row, the parsed SpreadsheetRow has the correct title, author,
   * and description values (trimmed to match the implementation behavior).
   */
  it('extracts correct field values for each row', () => {
    fc.assert(
      fc.asyncProperty(dataRowsArb, async (rows) => {
        const header = ['Abstract ID', 'Title', 'Author', 'Description'];
        const data = [header, ...rows.map(([id, title, author, desc]) => [id, title, author, desc])];
        const file = createXlsxFile(data);

        const result = await parseSpreadsheet(file);

        // Build a lookup by normalized abstract ID for comparison
        for (let i = 0; i < rows.length; i++) {
          const [, expectedTitle, expectedAuthor, expectedDesc] = rows[i];
          const parsed = result[i];

          expect(parsed.title).toBe(expectedTitle.trim());
          expect(parsed.author).toBe(expectedAuthor.trim());
          expect(parsed.description).toBe(expectedDesc.trim());
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2**
   *
   * For any data row with an ABS-N abstract ID, the parsed abstractId is
   * normalized (leading zeros stripped), matching the format "ABS-{number}".
   */
  it('normalizes abstract IDs by stripping leading zeros', () => {
    fc.assert(
      fc.asyncProperty(
        fc.tuple(leadingZerosArb, absNumArb, cellTextArb, cellTextArb, cellTextArb),
        async ([zeros, num, title, author, desc]) => {
          const rawId = `ABS-${zeros}${num}`;
          const header = ['Abstract ID', 'Title', 'Author', 'Description'];
          const data = [header, [rawId, title, author, desc]];
          const file = createXlsxFile(data);

          const result = await parseSpreadsheet(file);

          expect(result).toHaveLength(1);
          expect(result[0].abstractId).toBe(`ABS-${num}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 2.2**
   *
   * An empty spreadsheet (header only, no data rows) returns zero rows.
   */
  it('returns empty array for header-only spreadsheet', () => {
    fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async () => {
          const header = ['Abstract ID', 'Title', 'Author', 'Description'];
          const file = createXlsxFile([header]);

          const result = await parseSpreadsheet(file);

          expect(result).toHaveLength(0);
        }
      ),
      { numRuns: 1 }
    );
  });
});
