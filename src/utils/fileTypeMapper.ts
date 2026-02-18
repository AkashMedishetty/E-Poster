/**
 * Maps a file extension to its poster type category.
 *
 * Mapping:
 *   {jpg, jpeg, png} → "image"
 *   {pdf}            → "pdf"
 *   {ppt, pptx}      → "document"
 *
 * Returns null for unsupported extensions.
 */

export type PosterFileType = 'image' | 'pdf' | 'document';

const extensionMap: Record<string, PosterFileType> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  pdf: 'pdf',
  ppt: 'document',
  pptx: 'document',
};

export function mapExtensionToType(extension: string): PosterFileType | null {
  const normalized = extension.replace(/^\./, '').toLowerCase();
  return extensionMap[normalized] ?? null;
}
