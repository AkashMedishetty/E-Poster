import type { Abstract } from '../types/abstract';
import type { ScannedFile } from './fileSystemManager';
import type { SpreadsheetRow } from './spreadsheetParser';
import type { ParsedFilename } from './filenameParser';
import { parseFilename } from './filenameParser';
import { normalizeAbstractId } from './abstractIdNormalizer';

/**
 * Extracts the numeric portion from a normalized abstract ID for sorting.
 * Returns Infinity for IDs that can't be parsed (sorts them to the end).
 */
function extractNumericId(abstractId: string | undefined): number {
  if (!abstractId) return Infinity;
  const match = abstractId.match(/ABS-(\d+)/i);
  return match ? parseInt(match[1], 10) : Infinity;
}

/**
 * Merges scanned files with spreadsheet metadata to produce the final
 * list of Abstract entries.
 *
 * Merge logic:
 * 1. For each scanned file, extract the abstract ID via FilenameParser
 * 2. If a spreadsheet is loaded, look up the abstract ID in spreadsheet rows
 * 3. If matched, use spreadsheet metadata; otherwise, use filename-derived metadata
 * 4. For spreadsheet rows with no matching file, create entries with hasFile: false
 * 5. Sort by abstract ID ascending (numerically)
 */
export function generateAbstractList(
  scannedFiles: ScannedFile[],
  spreadsheetRows: SpreadsheetRow[] | null,
  parsedFilenames: ParsedFilename[]
): Abstract[] {
  // Build a lookup map from normalized abstract ID → spreadsheet row
  const spreadsheetMap = new Map<string, SpreadsheetRow>();
  if (spreadsheetRows) {
    for (const row of spreadsheetRows) {
      const normalized = normalizeAbstractId(row.abstractId);
      if (normalized) {
        spreadsheetMap.set(normalized, row);
      }
    }
  }

  // Track which spreadsheet rows have been matched to files
  const matchedSpreadsheetIds = new Set<string>();

  // Build abstracts from scanned files
  const abstracts: Abstract[] = scannedFiles.map((file, index) => {
    const parsed = parsedFilenames[index] ?? parseFilename(file.name);
    const normalizedId = parsed.abstractId
      ? normalizeAbstractId(parsed.abstractId)
      : null;

    const spreadsheetRow =
      normalizedId ? spreadsheetMap.get(normalizedId) : undefined;

    if (spreadsheetRow && normalizedId) {
      matchedSpreadsheetIds.add(normalizedId);
    }

    // Use spreadsheet metadata when matched, filename-derived as fallback
    const title = spreadsheetRow?.title || parsed.title || file.name;
    const author = spreadsheetRow?.author || parsed.author || 'Unknown';
    const description = spreadsheetRow?.description || '';
    
    // Extract regId from spreadsheet extra columns (common column names)
    const regId = spreadsheetRow?.['Reg ID'] || spreadsheetRow?.['RegID'] || 
                  spreadsheetRow?.['reg id'] || spreadsheetRow?.['regid'] ||
                  spreadsheetRow?.['Registration ID'] || spreadsheetRow?.['registration id'] ||
                  spreadsheetRow?.['Reg No'] || spreadsheetRow?.['reg no'] || '';

    return {
      id: normalizedId ? `${normalizedId}-${file.name}` : `file-${index}`,
      title,
      author,
      description,
      thumbnail: '',
      fileUrl: '',
      fileType: file.fileType,
      localFileName: file.name,
      fileHandle: file.handle,
      abstractId: normalizedId || parsed.abstractId || undefined,
      regId: regId || undefined,
      hasFile: true,
      source: 'local' as const,
    };
  });

  // Add spreadsheet-only entries (no matching file)
  if (spreadsheetRows) {
    for (const row of spreadsheetRows) {
      const normalized = normalizeAbstractId(row.abstractId);
      if (normalized && !matchedSpreadsheetIds.has(normalized)) {
        // Extract regId from extra columns
        const regId = row['Reg ID'] || row['RegID'] || 
                      row['reg id'] || row['regid'] ||
                      row['Registration ID'] || row['registration id'] ||
                      row['Reg No'] || row['reg no'] || '';
        
        abstracts.push({
          id: normalized,
          title: row.title || row.abstractId,
          author: row.author || 'Unknown',
          description: row.description || '',
          thumbnail: '',
          fileUrl: '',
          fileType: 'document',
          abstractId: normalized,
          regId: regId || undefined,
          hasFile: false,
          source: 'local' as const,
        });
      }
    }
  }

  // Sort by abstract ID ascending (numerically)
  abstracts.sort((a, b) => {
    return extractNumericId(a.abstractId) - extractNumericId(b.abstractId);
  });

  return abstracts;
}
