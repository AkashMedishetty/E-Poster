export interface ParsedFilename {
  abstractId: string | null;
  author: string | null;
  title: string;
  rawFilename: string;
}

/**
 * Extracts metadata from poster filenames.
 *
 * Known patterns:
 * - "Dr Jerold Pushparaj_New_ ABS-0002.jpg" → author + abstractId
 * - "OSSAP-023-OSSAP-023-ABS-76-final.pptx" → abstractId only
 * - "Dr Bela Jain ABS-0013.pptx (1).jpg" → author + abstractId
 *
 * Fallback: filename without extension as title, "Unknown" as author.
 */
export function parseFilename(filename: string): ParsedFilename {
  const rawFilename = filename;

  // Remove the file extension (handle compound like ".pptx (1).jpg" by stripping last extension first)
  const nameWithoutExt = stripExtension(filename);

  // Extract abstract ID: find ABS-\d+ pattern
  const absMatch = nameWithoutExt.match(/ABS-(\d+)/i);
  const abstractId = absMatch ? `ABS-${absMatch[1]}` : null;

  if (!abstractId) {
    // No ABS pattern found — fallback
    return {
      abstractId: null,
      author: null,
      title: nameWithoutExt,
      rawFilename,
    };
  }

  // Try to extract author from text before the ABS-ID
  const author = extractAuthor(nameWithoutExt, absMatch!);

  // Derive a title from the abstract ID
  const title = abstractId;

  return {
    abstractId,
    author,
    title,
    rawFilename,
  };
}

/**
 * Strips the file extension from a filename.
 * Handles compound extensions like "file.pptx (1).jpg" by removing the last dot-extension.
 */
function stripExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex < 0) return filename;
  return filename.substring(0, lastDotIndex);
}

/**
 * Attempts to extract an author name from the text preceding the ABS-ID.
 *
 * Heuristic: the text before ABS-NNNN is cleaned of prefixes, underscores,
 * and trailing separators. If it looks like a name (contains letters), return it.
 * Otherwise return null.
 */
function extractAuthor(
  nameWithoutExt: string,
  absMatch: RegExpMatchArray
): string | null {
  const absIndex = absMatch.index!;
  const beforeAbs = nameWithoutExt.substring(0, absIndex);

  // Clean up: replace underscores with spaces, trim separators
  let cleaned = beforeAbs
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove trailing noise words like "New" that are artifacts
  cleaned = cleaned.replace(/\s+New\s*$/i, '').trim();

  // Check if what remains looks like a prefix code (e.g., "OSSAP 023 OSSAP 023")
  // If it's all uppercase codes/numbers, it's not an author name
  if (!cleaned || isCodePrefix(cleaned)) {
    return null;
  }

  return cleaned;
}

/**
 * Determines if a string looks like a code prefix rather than an author name.
 * Code prefixes are typically all-uppercase with numbers and short segments.
 * Author names contain mixed case or title-case words.
 */
function isCodePrefix(text: string): boolean {
  // Split into words and check if they look like codes
  const words = text.split(/\s+/);
  const codePattern = /^[A-Z0-9]+$/;
  return words.every((word) => codePattern.test(word));
}
