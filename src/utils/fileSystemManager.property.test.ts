import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { getExtension, isSupportedExtension } from './fileSystemManager';
import { mapExtensionToType } from './fileTypeMapper';

/**
 * Feature: offline-poster-viewer, Property 1: File scanning returns only supported types
 *
 * Validates: Requirements 1.3, 1.4
 *
 * For any directory containing a mix of files with various extensions,
 * scanning the directory SHALL return only files with extensions in the set
 * {jpg, jpeg, png, pdf, ppt, pptx}, and no files with other extensions
 * shall appear in the result.
 *
 * Since FileSystemManager.scanFiles() depends on browser APIs, we test the
 * pure utility functions that implement the filtering logic: getExtension,
 * isSupportedExtension, and mapExtensionToType.
 */
describe('Property 1: File scanning returns only supported types', () => {
  const SUPPORTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'ppt', 'pptx'];

  const supportedExtArb = fc.constantFrom(...SUPPORTED_EXTENSIONS);

  // Generate unsupported extensions: alphanumeric strings that are NOT in the supported set
  const unsupportedExtArb = fc
    .string({
      minLength: 1,
      maxLength: 8,
      unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
    })
    .filter((s) => !SUPPORTED_EXTENSIONS.includes(s.toLowerCase()));

  // Generate a safe base filename (no dots, non-empty)
  const baseNameArb = fc
    .string({
      minLength: 1,
      maxLength: 30,
      unit: fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyz0123456789 _-'.split('')
      ),
    })
    .filter((s) => s.trim().length > 0 && !s.includes('.'));

  /**
   * **Validates: Requirements 1.3**
   *
   * For any filename with a supported extension, getExtension extracts it,
   * isSupportedExtension returns true, and mapExtensionToType returns a non-null type.
   */
  it('accepts all filenames with supported extensions', () => {
    fc.assert(
      fc.property(baseNameArb, supportedExtArb, (baseName, ext) => {
        const filename = `${baseName}.${ext}`;
        const extracted = getExtension(filename);

        expect(extracted).toBe(ext.toLowerCase());
        expect(isSupportedExtension(extracted)).toBe(true);
        expect(mapExtensionToType(extracted)).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   *
   * For any filename with an unsupported extension, isSupportedExtension returns false.
   */
  it('rejects all filenames with unsupported extensions', () => {
    fc.assert(
      fc.property(baseNameArb, unsupportedExtArb, (baseName, ext) => {
        const filename = `${baseName}.${ext}`;
        const extracted = getExtension(filename);

        expect(isSupportedExtension(extracted)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.3, 1.4**
   *
   * For any mixed list of filenames (some supported, some not), filtering by
   * isSupportedExtension yields exactly the supported ones and excludes all others.
   */
  it('filtering a mixed file list retains only supported types', () => {
    const supportedFileArb = fc
      .tuple(baseNameArb, supportedExtArb)
      .map(([base, ext]) => `${base}.${ext}`);

    const unsupportedFileArb = fc
      .tuple(baseNameArb, unsupportedExtArb)
      .map(([base, ext]) => `${base}.${ext}`);

    const mixedListArb = fc.tuple(
      fc.array(supportedFileArb, { minLength: 0, maxLength: 10 }),
      fc.array(unsupportedFileArb, { minLength: 0, maxLength: 10 })
    );

    fc.assert(
      fc.property(mixedListArb, ([supportedFiles, unsupportedFiles]) => {
        const allFiles = [...supportedFiles, ...unsupportedFiles];

        const filtered = allFiles.filter((f) => {
          const ext = getExtension(f);
          return isSupportedExtension(ext);
        });

        // Every filtered file must have a supported extension
        for (const f of filtered) {
          const ext = getExtension(f);
          expect(SUPPORTED_EXTENSIONS).toContain(ext);
          expect(mapExtensionToType(ext)).not.toBeNull();
        }

        // No unsupported file should appear in the filtered result
        for (const f of unsupportedFiles) {
          expect(filtered).not.toContain(f);
        }

        // All supported files should appear in the filtered result
        for (const f of supportedFiles) {
          expect(filtered).toContain(f);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.3**
   *
   * Supported extension check is case-insensitive: upper/mixed case variations
   * of supported extensions are still accepted.
   */
  it('accepts supported extensions regardless of case', () => {
    const caseVariantArb = fc
      .tuple(
        supportedExtArb,
        fc.array(fc.boolean(), { minLength: 10, maxLength: 10 })
      )
      .map(([ext, bools]) =>
        ext
          .split('')
          .map((ch, i) => (bools[i % bools.length] ? ch.toUpperCase() : ch))
          .join('')
      );

    fc.assert(
      fc.property(baseNameArb, caseVariantArb, (baseName, ext) => {
        const filename = `${baseName}.${ext}`;
        const extracted = getExtension(filename);

        expect(isSupportedExtension(extracted)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
