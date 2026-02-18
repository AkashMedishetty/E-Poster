import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mapExtensionToType } from './fileTypeMapper';

/**
 * Feature: offline-poster-viewer, Property 6: File extension to type mapping
 *
 * Validates: Requirements 3.4
 *
 * For any file with a supported extension, the type mapping function SHALL assign:
 * {jpg, jpeg, png} → "image", {pdf} → "pdf", {ppt, pptx} → "document".
 */
describe('Property 6: File extension to type mapping', () => {
  const imageExtensions = fc.constantFrom('jpg', 'jpeg', 'png');
  const pdfExtensions = fc.constant('pdf');
  const documentExtensions = fc.constantFrom('ppt', 'pptx');

  const allSupportedExtensions = fc.constantFrom('jpg', 'jpeg', 'png', 'pdf', 'ppt', 'pptx');

  // Generator for case variations of a string
  const withRandomCase = (extArb: fc.Arbitrary<string>) =>
    fc.tuple(extArb, fc.array(fc.boolean(), { minLength: 10, maxLength: 10 })).map(
      ([ext, bools]) =>
        ext
          .split('')
          .map((ch, i) => (bools[i % bools.length] ? ch.toUpperCase() : ch.toLowerCase()))
          .join('')
    );

  /**
   * **Validates: Requirements 3.4**
   *
   * Image extensions {jpg, jpeg, png} always map to "image".
   */
  it('maps image extensions to "image"', () => {
    fc.assert(
      fc.property(imageExtensions, (ext) => {
        expect(mapExtensionToType(ext)).toBe('image');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * PDF extension maps to "pdf".
   */
  it('maps pdf extension to "pdf"', () => {
    fc.assert(
      fc.property(pdfExtensions, (ext) => {
        expect(mapExtensionToType(ext)).toBe('pdf');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * Document extensions {ppt, pptx} map to "document".
   */
  it('maps document extensions to "document"', () => {
    fc.assert(
      fc.property(documentExtensions, (ext) => {
        expect(mapExtensionToType(ext)).toBe('document');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * Mapping is case-insensitive: any case variation of a supported extension
   * produces the same result as the lowercase version.
   */
  it('is case-insensitive for all supported extensions', () => {
    fc.assert(
      fc.property(withRandomCase(allSupportedExtensions), (ext) => {
        const result = mapExtensionToType(ext);
        const expected = mapExtensionToType(ext.toLowerCase());
        expect(result).toBe(expected);
        expect(result).not.toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * Extensions with a leading dot are handled the same as without.
   */
  it('handles extensions with leading dot identically', () => {
    fc.assert(
      fc.property(allSupportedExtensions, (ext) => {
        const withDot = mapExtensionToType(`.${ext}`);
        const withoutDot = mapExtensionToType(ext);
        expect(withDot).toBe(withoutDot);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * Unsupported extensions return null.
   */
  it('returns null for unsupported extensions', () => {
    const unsupportedArb = fc
      .string({ minLength: 1, maxLength: 10, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')) })
      .filter((s) => !['jpg', 'jpeg', 'png', 'pdf', 'ppt', 'pptx'].includes(s.toLowerCase()));

    fc.assert(
      fc.property(unsupportedArb, (ext) => {
        expect(mapExtensionToType(ext)).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});
