import { describe, it, expect } from 'vitest';
import { mapExtensionToType } from './fileTypeMapper';

describe('mapExtensionToType', () => {
  it('maps jpg to "image"', () => {
    expect(mapExtensionToType('jpg')).toBe('image');
  });

  it('maps jpeg to "image"', () => {
    expect(mapExtensionToType('jpeg')).toBe('image');
  });

  it('maps png to "image"', () => {
    expect(mapExtensionToType('png')).toBe('image');
  });

  it('maps pdf to "pdf"', () => {
    expect(mapExtensionToType('pdf')).toBe('pdf');
  });

  it('maps ppt to "document"', () => {
    expect(mapExtensionToType('ppt')).toBe('document');
  });

  it('maps pptx to "document"', () => {
    expect(mapExtensionToType('pptx')).toBe('document');
  });

  it('is case-insensitive', () => {
    expect(mapExtensionToType('JPG')).toBe('image');
    expect(mapExtensionToType('PDF')).toBe('pdf');
    expect(mapExtensionToType('PPTX')).toBe('document');
    expect(mapExtensionToType('Jpeg')).toBe('image');
  });

  it('handles extensions with a leading dot', () => {
    expect(mapExtensionToType('.jpg')).toBe('image');
    expect(mapExtensionToType('.pdf')).toBe('pdf');
    expect(mapExtensionToType('.pptx')).toBe('document');
  });

  it('returns null for unsupported extensions', () => {
    expect(mapExtensionToType('gif')).toBeNull();
    expect(mapExtensionToType('bmp')).toBeNull();
    expect(mapExtensionToType('docx')).toBeNull();
    expect(mapExtensionToType('txt')).toBeNull();
    expect(mapExtensionToType('mp4')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(mapExtensionToType('')).toBeNull();
  });
});
