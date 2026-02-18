import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSpreadsheet, detectColumnMappings } from './spreadsheetParser';

/**
 * Helper: create a File from a 2D array (first row = headers) using xlsx to build a workbook.
 */
function createXlsxFile(
  data: string[][],
  filename = 'test.xlsx'
): File {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new File([buf], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Helper: create a CSV File from a string.
 */
function createCsvFile(csvContent: string, filename = 'test.csv'): File {
  return new File([csvContent], filename, { type: 'text/csv' });
}

describe('detectColumnMappings', () => {
  it('detects standard column names', () => {
    const headers = ['Abstract ID', 'Title', 'Author', 'Description'];
    const mappings = detectColumnMappings(headers);
    expect(mappings.abstractId).toBe('Abstract ID');
    expect(mappings.title).toBe('Title');
    expect(mappings.author).toBe('Author');
    expect(mappings.description).toBe('Description');
  });

  it('detects alternative column names', () => {
    const headers = ['ID', 'Subject', 'Presenter', 'Summary'];
    const mappings = detectColumnMappings(headers);
    expect(mappings.abstractId).toBe('ID');
    expect(mappings.title).toBe('Subject');
    expect(mappings.author).toBe('Presenter');
    expect(mappings.description).toBe('Summary');
  });

  it('handles case-insensitive matching', () => {
    const headers = ['ABSTRACT ID', 'TITLE', 'AUTHOR NAME', 'DESCRIPTION'];
    const mappings = detectColumnMappings(headers);
    expect(mappings.abstractId).toBe('ABSTRACT ID');
    expect(mappings.title).toBe('TITLE');
    expect(mappings.author).toBe('AUTHOR NAME');
    expect(mappings.description).toBe('DESCRIPTION');
  });

  it('returns partial mappings when some columns are missing', () => {
    const headers = ['Abstract ID', 'Title'];
    const mappings = detectColumnMappings(headers);
    expect(mappings.abstractId).toBe('Abstract ID');
    expect(mappings.title).toBe('Title');
    expect(mappings.author).toBeUndefined();
    expect(mappings.description).toBeUndefined();
  });
});

describe('parseSpreadsheet', () => {
  it('parses an xlsx file with standard columns', async () => {
    const file = createXlsxFile([
      ['Abstract ID', 'Title', 'Author', 'Description'],
      ['ABS-0001', 'My Poster', 'Jane Doe', 'A great poster'],
      ['ABS-0002', 'Another Poster', 'John Smith', 'Another description'],
    ]);

    const rows = await parseSpreadsheet(file);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      abstractId: 'ABS-1',
      title: 'My Poster',
      author: 'Jane Doe',
      description: 'A great poster',
    });
    expect(rows[1]).toEqual({
      abstractId: 'ABS-2',
      title: 'Another Poster',
      author: 'John Smith',
      description: 'Another description',
    });
  });

  it('normalizes abstract IDs with leading zeros', async () => {
    const file = createXlsxFile([
      ['Abstract ID', 'Title', 'Author', 'Description'],
      ['ABS-0076', 'Poster A', 'Author A', 'Desc A'],
      ['ABS-76', 'Poster B', 'Author B', 'Desc B'],
    ]);

    const rows = await parseSpreadsheet(file);
    expect(rows[0].abstractId).toBe('ABS-76');
    expect(rows[1].abstractId).toBe('ABS-76');
  });

  it('parses a CSV file', async () => {
    const csv = `Abstract ID,Title,Author,Description
ABS-0010,CSV Poster,CSV Author,CSV Description
ABS-0020,Second CSV,Another Author,More text`;

    const file = createCsvFile(csv);
    const rows = await parseSpreadsheet(file);
    expect(rows).toHaveLength(2);
    expect(rows[0].abstractId).toBe('ABS-10');
    expect(rows[0].title).toBe('CSV Poster');
    expect(rows[1].abstractId).toBe('ABS-20');
  });

  it('preserves additional columns beyond the standard four', async () => {
    const file = createXlsxFile([
      ['Abstract ID', 'Title', 'Author', 'Description', 'Session', 'Room'],
      ['ABS-1', 'Poster', 'Author', 'Desc', 'Morning', 'Room A'],
    ]);

    const rows = await parseSpreadsheet(file);
    expect(rows[0].Session).toBe('Morning');
    expect(rows[0].Room).toBe('Room A');
  });

  it('filters out rows with empty abstract IDs', async () => {
    const file = createXlsxFile([
      ['Abstract ID', 'Title', 'Author', 'Description'],
      ['ABS-1', 'Valid', 'Author', 'Desc'],
      ['', 'No ID', 'Author', 'Desc'],
      ['ABS-3', 'Also Valid', 'Author', 'Desc'],
    ]);

    const rows = await parseSpreadsheet(file);
    expect(rows).toHaveLength(2);
    expect(rows[0].abstractId).toBe('ABS-1');
    expect(rows[1].abstractId).toBe('ABS-3');
  });

  it('returns empty array for empty spreadsheet', async () => {
    const file = createXlsxFile([['Abstract ID', 'Title', 'Author', 'Description']]);
    const rows = await parseSpreadsheet(file);
    expect(rows).toHaveLength(0);
  });

  it('returns empty array for workbook with no sheets', async () => {
    const wb = XLSX.utils.book_new();
    // Create a workbook with an empty sheet
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'empty.xlsx');

    const rows = await parseSpreadsheet(file);
    expect(rows).toHaveLength(0);
  });

  it('handles columns with alternative names like Presenter and Subject', async () => {
    const file = createXlsxFile([
      ['ID', 'Subject', 'Presenter', 'Summary'],
      ['ABS-5', 'Topic One', 'Dr. Smith', 'A summary'],
    ]);

    const rows = await parseSpreadsheet(file);
    expect(rows).toHaveLength(1);
    expect(rows[0].abstractId).toBe('ABS-5');
    expect(rows[0].title).toBe('Topic One');
    expect(rows[0].author).toBe('Dr. Smith');
    expect(rows[0].description).toBe('A summary');
  });

  it('trims whitespace from cell values', async () => {
    const file = createXlsxFile([
      ['Abstract ID', 'Title', 'Author', 'Description'],
      ['  ABS-0007  ', '  Spaced Title  ', '  Spaced Author  ', '  Spaced Desc  '],
    ]);

    const rows = await parseSpreadsheet(file);
    expect(rows[0].abstractId).toBe('ABS-7');
    expect(rows[0].title).toBe('Spaced Title');
    expect(rows[0].author).toBe('Spaced Author');
    expect(rows[0].description).toBe('Spaced Desc');
  });

  it('sets empty strings for unmapped columns', async () => {
    const file = createXlsxFile([
      ['Abstract ID', 'Random Column'],
      ['ABS-1', 'Some value'],
    ]);

    const rows = await parseSpreadsheet(file);
    expect(rows[0].title).toBe('');
    expect(rows[0].author).toBe('');
    expect(rows[0].description).toBe('');
    expect(rows[0]['Random Column']).toBe('Some value');
  });
});
