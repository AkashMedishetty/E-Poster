import * as XLSX from 'xlsx';
import { normalizeAbstractId } from './abstractIdNormalizer';

export interface SpreadsheetRow {
  abstractId: string;
  title: string;
  author: string;
  description: string;
  [key: string]: string;
}

/**
 * Known header aliases for auto-detecting column mappings.
 * Keys are our canonical field names; values are lowercase substrings to match against.
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  abstractId: ['abstract', 'abs', 'id'],
  title: ['title', 'subject', 'topic'],
  author: ['author', 'presenter', 'name', 'speaker'],
  description: ['description', 'summary', 'abstract text', 'body', 'content'],
};

/**
 * Auto-detect which spreadsheet column maps to which field
 * by checking if the header contains any known alias substring.
 */
function detectColumnMappings(headers: string[]): Record<string, string> {
  const mappings: Record<string, string> = {};

  for (const header of headers) {
    const lower = header.toLowerCase().trim();

    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (mappings[field]) continue; // already mapped

      for (const alias of aliases) {
        if (lower.includes(alias)) {
          mappings[field] = header;
          break;
        }
      }
    }
  }

  return mappings;
}

/**
 * Parse an Excel (.xlsx) or CSV file and return an array of SpreadsheetRow objects.
 * Auto-detects column mappings from header names.
 */
export async function parseSpreadsheet(file: File): Promise<SpreadsheetRow[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  });

  if (rawRows.length === 0) {
    return [];
  }

  const headers = Object.keys(rawRows[0]);
  const mappings = detectColumnMappings(headers);

  return rawRows
    .map((row) => {
      const rawAbstractId = mappings.abstractId
        ? String(row[mappings.abstractId] ?? '').trim()
        : '';

      const normalized = rawAbstractId
        ? normalizeAbstractId(rawAbstractId)
        : null;

      const abstractId = normalized ?? rawAbstractId;

      const title = mappings.title
        ? String(row[mappings.title] ?? '').trim()
        : '';
      const author = mappings.author
        ? String(row[mappings.author] ?? '').trim()
        : '';
      const description = mappings.description
        ? String(row[mappings.description] ?? '').trim()
        : '';

      // Collect all additional columns
      const extra: Record<string, string> = {};
      for (const header of headers) {
        if (
          header !== mappings.abstractId &&
          header !== mappings.title &&
          header !== mappings.author &&
          header !== mappings.description
        ) {
          extra[header] = String(row[header] ?? '').trim();
        }
      }

      return {
        abstractId,
        title,
        author,
        description,
        ...extra,
      };
    })
    .filter((row) => row.abstractId !== '');
}

// Exported for testing
export { detectColumnMappings };
