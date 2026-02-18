/**
 * DataExporter — serializes interaction data to JSON/CSV and triggers browser downloads.
 */

import type { PosterInteractions, Comment } from './interactionStore';

/**
 * Wrapper for JSON export format.
 */
export interface InteractionExport {
  exportedAt: string; // ISO timestamp
  totalPosters: number;
  posters: PosterInteractions[];
}

/**
 * Represents a single row in the CSV export.
 */
export interface CsvRow {
  abstract_id: string;
  type: 'reaction' | 'comment' | 'likes';
  emoji: string;
  count: string;
  comment_text: string;
  timestamp: string;
  likes: string;
}

const CSV_HEADER = 'abstract_id,type,emoji,count,comment_text,timestamp,likes';

/**
 * Escape a value for CSV output. Wraps in quotes if it contains commas,
 * quotes, or newlines.
 */
function escapeCsvValue(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialize interactions to JSON format.
 */
export function exportAsJson(interactions: PosterInteractions[]): string {
  const exportData: InteractionExport = {
    exportedAt: new Date().toISOString(),
    totalPosters: interactions.length,
    posters: interactions,
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Serialize interactions to CSV format.
 * Each reaction, comment, and likes count becomes its own row.
 */
export function exportAsCsv(interactions: PosterInteractions[]): string {
  const lines: string[] = [CSV_HEADER];

  for (const poster of interactions) {
    const id = poster.abstractId;

    // Reaction rows
    for (const [emoji, count] of Object.entries(poster.reactions)) {
      lines.push(
        `${escapeCsvValue(id)},reaction,${escapeCsvValue(emoji)},${count},,,`
      );
    }

    // Comment rows
    for (const comment of poster.comments) {
      lines.push(
        `${escapeCsvValue(id)},comment,,,"${comment.text.replace(/"/g, '""')}",${comment.timestamp},`
      );
    }

    // Likes row (only if likes > 0)
    if (poster.likes > 0) {
      lines.push(`${escapeCsvValue(id)},likes,,,,,${poster.likes}`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse a CSV string (produced by exportAsCsv) back into CsvRow objects.
 * Used for round-trip validation.
 */
export function parseCsv(csv: string): CsvRow[] {
  const lines = csv.split('\n');
  if (lines.length < 2) return [];

  // Skip header
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = parseCsvLine(line);
    rows.push({
      abstract_id: fields[0] || '',
      type: fields[1] as CsvRow['type'],
      emoji: fields[2] || '',
      count: fields[3] || '',
      comment_text: fields[4] || '',
      timestamp: fields[5] || '',
      likes: fields[6] || '',
    });
  }

  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields with commas and escaped quotes.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ',') {
        fields.push(current);
        current = '';
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Trigger a browser download of the given content.
 * Creates a temporary <a> element, clicks it, then cleans up.
 */
export function triggerDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
