import { describe, it, expect } from 'vitest';
import { generateAbstractList } from './abstractListGenerator';
import type { ScannedFile } from './fileSystemManager';
import type { SpreadsheetRow } from './spreadsheetParser';
import type { ParsedFilename } from './filenameParser';

// Helper to create a mock ScannedFile
function mockScannedFile(
  name: string,
  ext: string,
  fileType: 'image' | 'pdf' | 'document' = 'image'
): ScannedFile {
  return {
    name,
    extension: ext,
    fileType,
    handle: {} as FileSystemFileHandle,
  };
}

// Helper to create a mock ParsedFilename
function mockParsed(
  abstractId: string | null,
  author: string | null,
  title: string,
  rawFilename: string
): ParsedFilename {
  return { abstractId, author, title, rawFilename };
}

// Helper to create a SpreadsheetRow
function mockRow(
  abstractId: string,
  title: string,
  author: string,
  description: string
): SpreadsheetRow {
  return { abstractId, title, author, description };
}

describe('generateAbstractList', () => {
  it('generates abstracts from scanned files without spreadsheet', () => {
    const files = [
      mockScannedFile('Dr Smith ABS-0003.jpg', 'jpg', 'image'),
      mockScannedFile('Dr Jones ABS-0001.pdf', 'pdf', 'pdf'),
    ];
    const parsed = [
      mockParsed('ABS-0003', 'Dr Smith', 'ABS-0003', 'Dr Smith ABS-0003.jpg'),
      mockParsed('ABS-0001', 'Dr Jones', 'ABS-0001', 'Dr Jones ABS-0001.pdf'),
    ];

    const result = generateAbstractList(files, null, parsed);

    expect(result).toHaveLength(2);
    // Should be sorted by abstract ID ascending
    expect(result[0].abstractId).toBe('ABS-1');
    expect(result[0].author).toBe('Dr Jones');
    expect(result[0].fileType).toBe('pdf');
    expect(result[0].hasFile).toBe(true);
    expect(result[0].source).toBe('local');

    expect(result[1].abstractId).toBe('ABS-3');
    expect(result[1].author).toBe('Dr Smith');
    expect(result[1].fileType).toBe('image');
  });

  it('uses spreadsheet metadata when matched', () => {
    const files = [mockScannedFile('ABS-0002.jpg', 'jpg', 'image')];
    const parsed = [mockParsed('ABS-0002', null, 'ABS-0002', 'ABS-0002.jpg')];
    const rows = [
      mockRow('ABS-2', 'Quantum Computing Study', 'Dr Alice', 'A deep dive into quantum computing'),
    ];

    const result = generateAbstractList(files, rows, parsed);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Quantum Computing Study');
    expect(result[0].author).toBe('Dr Alice');
    expect(result[0].description).toBe('A deep dive into quantum computing');
    expect(result[0].hasFile).toBe(true);
  });

  it('falls back to filename-derived metadata when no spreadsheet match', () => {
    const files = [mockScannedFile('Dr Bob ABS-0005.pdf', 'pdf', 'pdf')];
    const parsed = [mockParsed('ABS-0005', 'Dr Bob', 'ABS-0005', 'Dr Bob ABS-0005.pdf')];
    const rows = [
      mockRow('ABS-99', 'Unrelated Paper', 'Someone Else', 'No match'),
    ];

    const result = generateAbstractList(files, rows, parsed);

    // File entry uses filename-derived metadata
    const fileEntry = result.find((a) => a.abstractId === 'ABS-5');
    expect(fileEntry).toBeDefined();
    expect(fileEntry!.author).toBe('Dr Bob');
    expect(fileEntry!.title).toBe('ABS-0005');
    expect(fileEntry!.hasFile).toBe(true);
  });

  it('marks spreadsheet-only entries with hasFile: false', () => {
    const files = [mockScannedFile('ABS-0001.jpg', 'jpg', 'image')];
    const parsed = [mockParsed('ABS-0001', null, 'ABS-0001', 'ABS-0001.jpg')];
    const rows = [
      mockRow('ABS-1', 'Paper One', 'Author One', 'Desc One'),
      mockRow('ABS-10', 'Paper Ten', 'Author Ten', 'Desc Ten'),
    ];

    const result = generateAbstractList(files, rows, parsed);

    expect(result).toHaveLength(2);

    const withFile = result.find((a) => a.abstractId === 'ABS-1');
    expect(withFile!.hasFile).toBe(true);

    const withoutFile = result.find((a) => a.abstractId === 'ABS-10');
    expect(withoutFile!.hasFile).toBe(false);
    expect(withoutFile!.title).toBe('Paper Ten');
    expect(withoutFile!.author).toBe('Author Ten');
    expect(withoutFile!.fileType).toBe('document');
  });

  it('sorts results by abstract ID ascending numerically', () => {
    const files = [
      mockScannedFile('ABS-0100.jpg', 'jpg', 'image'),
      mockScannedFile('ABS-0002.pdf', 'pdf', 'pdf'),
      mockScannedFile('ABS-0050.pptx', 'pptx', 'document'),
    ];
    const parsed = [
      mockParsed('ABS-0100', null, 'ABS-0100', 'ABS-0100.jpg'),
      mockParsed('ABS-0002', null, 'ABS-0002', 'ABS-0002.pdf'),
      mockParsed('ABS-0050', null, 'ABS-0050', 'ABS-0050.pptx'),
    ];

    const result = generateAbstractList(files, null, parsed);

    expect(result.map((a) => a.abstractId)).toEqual(['ABS-2', 'ABS-50', 'ABS-100']);
  });

  it('handles empty inputs', () => {
    const result = generateAbstractList([], null, []);
    expect(result).toEqual([]);
  });

  it('handles empty spreadsheet rows', () => {
    const result = generateAbstractList([], [], []);
    expect(result).toEqual([]);
  });

  it('handles files without parseable abstract IDs', () => {
    const files = [mockScannedFile('random_poster.jpg', 'jpg', 'image')];
    const parsed = [mockParsed(null, null, 'random_poster', 'random_poster.jpg')];

    const result = generateAbstractList(files, null, parsed);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('random_poster');
    expect(result[0].author).toBe('Unknown');
    expect(result[0].hasFile).toBe(true);
    expect(result[0].abstractId).toBeUndefined();
  });

  it('normalizes abstract IDs for matching (leading zeros)', () => {
    const files = [mockScannedFile('ABS-0002.jpg', 'jpg', 'image')];
    const parsed = [mockParsed('ABS-0002', null, 'ABS-0002', 'ABS-0002.jpg')];
    const rows = [mockRow('ABS-2', 'Matched Paper', 'Matched Author', 'Matched Desc')];

    const result = generateAbstractList(files, rows, parsed);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Matched Paper');
    expect(result[0].author).toBe('Matched Author');
  });

  it('entries without abstract IDs sort to the end', () => {
    const files = [
      mockScannedFile('random.jpg', 'jpg', 'image'),
      mockScannedFile('ABS-0001.pdf', 'pdf', 'pdf'),
    ];
    const parsed = [
      mockParsed(null, null, 'random', 'random.jpg'),
      mockParsed('ABS-0001', null, 'ABS-0001', 'ABS-0001.pdf'),
    ];

    const result = generateAbstractList(files, null, parsed);

    expect(result).toHaveLength(2);
    expect(result[0].abstractId).toBe('ABS-1');
    expect(result[1].abstractId).toBeUndefined();
  });
});
