import { describe, it, expect } from 'vitest';
import { parseFilename } from './filenameParser';

describe('parseFilename', () => {
  describe('known patterns from existing data', () => {
    it('parses "Dr Jerold Pushparaj_New_ ABS-0002.jpg"', () => {
      const result = parseFilename('Dr Jerold Pushparaj_New_ ABS-0002.jpg');
      expect(result.abstractId).toBe('ABS-0002');
      expect(result.author).toBe('Dr Jerold Pushparaj');
      expect(result.rawFilename).toBe('Dr Jerold Pushparaj_New_ ABS-0002.jpg');
    });

    it('parses "OSSAP-023-OSSAP-023-ABS-76-final.pptx"', () => {
      const result = parseFilename('OSSAP-023-OSSAP-023-ABS-76-final.pptx');
      expect(result.abstractId).toBe('ABS-76');
      expect(result.author).toBeNull();
      expect(result.rawFilename).toBe('OSSAP-023-OSSAP-023-ABS-76-final.pptx');
    });

    it('parses "Dr Bela Jain ABS-0013.pptx (1).jpg"', () => {
      const result = parseFilename('Dr Bela Jain ABS-0013.pptx (1).jpg');
      expect(result.abstractId).toBe('ABS-0013');
      expect(result.author).toBe('Dr Bela Jain');
      expect(result.rawFilename).toBe('Dr Bela Jain ABS-0013.pptx (1).jpg');
    });
  });

  describe('abstract ID extraction', () => {
    it('extracts ABS-NNNN pattern', () => {
      const result = parseFilename('poster ABS-1234.pdf');
      expect(result.abstractId).toBe('ABS-1234');
    });

    it('extracts ABS-NN pattern (short ID)', () => {
      const result = parseFilename('poster ABS-5.png');
      expect(result.abstractId).toBe('ABS-5');
    });

    it('extracts first ABS pattern when multiple exist', () => {
      const result = parseFilename('ABS-10-copy-ABS-20.pdf');
      expect(result.abstractId).toBe('ABS-10');
    });
  });

  describe('fallback behavior', () => {
    it('uses filename without extension as title when no ABS pattern', () => {
      const result = parseFilename('my-poster-presentation.pdf');
      expect(result.abstractId).toBeNull();
      expect(result.author).toBeNull();
      expect(result.title).toBe('my-poster-presentation');
    });

    it('handles filename with no extension', () => {
      const result = parseFilename('poster');
      expect(result.abstractId).toBeNull();
      expect(result.title).toBe('poster');
    });

    it('handles empty-ish filenames gracefully', () => {
      const result = parseFilename('.jpg');
      expect(result.abstractId).toBeNull();
      expect(result.title).toBe('');
    });
  });

  describe('author extraction', () => {
    it('extracts author with underscores as separators', () => {
      const result = parseFilename('John_Smith ABS-100.jpg');
      expect(result.author).toBe('John Smith');
    });

    it('returns null author for code-only prefixes', () => {
      const result = parseFilename('XYZ-123-ABS-45.pdf');
      expect(result.author).toBeNull();
    });

    it('extracts author with spaces', () => {
      const result = parseFilename('Jane Doe ABS-200.png');
      expect(result.author).toBe('Jane Doe');
    });
  });

  describe('rawFilename preservation', () => {
    it('always preserves the original filename', () => {
      const filename = 'Some Complex_Name ABS-99.pptx';
      const result = parseFilename(filename);
      expect(result.rawFilename).toBe(filename);
    });
  });
});
