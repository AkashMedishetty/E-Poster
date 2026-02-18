import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FileSystemManager,
  getExtension,
  isSupportedExtension,
  type ScannedFile,
} from './fileSystemManager';

// --- Pure utility tests (no mocking needed) ---

describe('getExtension', () => {
  it('extracts extension from a normal filename', () => {
    expect(getExtension('poster.jpg')).toBe('jpg');
  });

  it('extracts extension case-insensitively', () => {
    expect(getExtension('poster.PNG')).toBe('png');
    expect(getExtension('file.PPTX')).toBe('pptx');
  });

  it('uses the last dot for files with multiple dots', () => {
    expect(getExtension('my.poster.file.pdf')).toBe('pdf');
  });

  it('returns empty string for files with no extension', () => {
    expect(getExtension('README')).toBe('');
  });

  it('returns empty string for files ending with a dot', () => {
    expect(getExtension('file.')).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(getExtension('')).toBe('');
  });
});

describe('isSupportedExtension', () => {
  it.each(['jpg', 'jpeg', 'png', 'pdf', 'ppt', 'pptx'])(
    'returns true for supported extension "%s"',
    (ext) => {
      expect(isSupportedExtension(ext)).toBe(true);
    }
  );

  it('is case-insensitive', () => {
    expect(isSupportedExtension('JPG')).toBe(true);
    expect(isSupportedExtension('Pdf')).toBe(true);
  });

  it.each(['gif', 'bmp', 'docx', 'txt', 'mp4', 'svg', ''])(
    'returns false for unsupported extension "%s"',
    (ext) => {
      expect(isSupportedExtension(ext)).toBe(false);
    }
  );
});

// --- FileSystemManager class tests (with mocks) ---

/**
 * Helper to create a mock FileSystemFileHandle entry.
 */
function mockFileEntry(name: string): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: vi.fn().mockResolvedValue(new File([''], name)),
    createWritable: vi.fn(),
    createSyncAccessHandle: vi.fn(),
    isSameEntry: vi.fn(),
    queryPermission: vi.fn(),
    requestPermission: vi.fn(),
  } as unknown as FileSystemFileHandle;
}

/**
 * Helper to create a mock directory entry (should be skipped by scanFiles).
 */
function mockDirectoryEntry(name: string): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
  } as unknown as FileSystemDirectoryHandle;
}

/**
 * Creates a mock FileSystemDirectoryHandle whose values() yields the given entries.
 */
function mockDirectoryHandle(
  entries: (FileSystemFileHandle | FileSystemDirectoryHandle)[]
): FileSystemDirectoryHandle {
  return {
    values: () => {
      let index = 0;
      return {
        [Symbol.asyncIterator]() {
          return this;
        },
        next() {
          if (index < entries.length) {
            return Promise.resolve({ value: entries[index++], done: false });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
    getFileHandle: vi.fn((name: string) => {
      const entry = entries.find((e) => e.name === name && e.kind === 'file');
      if (!entry) return Promise.reject(new DOMException('Not found', 'NotFoundError'));
      return Promise.resolve(entry);
    }),
  } as unknown as FileSystemDirectoryHandle;
}

describe('FileSystemManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSupported', () => {
    it('returns true when showDirectoryPicker is available', () => {
      vi.stubGlobal('showDirectoryPicker', vi.fn());
      expect(FileSystemManager.isSupported()).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  describe('pickDirectory', () => {
    it('returns true when user selects a directory', async () => {
      const handle = mockDirectoryHandle([]);
      vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));

      const manager = new FileSystemManager();
      const result = await manager.pickDirectory();

      expect(result).toBe(true);
      expect(manager.isDirectoryLoaded()).toBe(true);
      vi.unstubAllGlobals();
    });

    it('returns false when user cancels the picker', async () => {
      vi.stubGlobal(
        'showDirectoryPicker',
        vi.fn().mockRejectedValue(new DOMException('User cancelled', 'AbortError'))
      );

      const manager = new FileSystemManager();
      const result = await manager.pickDirectory();

      expect(result).toBe(false);
      expect(manager.isDirectoryLoaded()).toBe(false);
      vi.unstubAllGlobals();
    });

    it('rethrows non-abort errors', async () => {
      vi.stubGlobal(
        'showDirectoryPicker',
        vi.fn().mockRejectedValue(new Error('Something went wrong'))
      );

      const manager = new FileSystemManager();
      await expect(manager.pickDirectory()).rejects.toThrow('Something went wrong');
      vi.unstubAllGlobals();
    });
  });

  describe('isDirectoryLoaded', () => {
    it('returns false initially', () => {
      const manager = new FileSystemManager();
      expect(manager.isDirectoryLoaded()).toBe(false);
    });
  });

  describe('scanFiles', () => {
    it('throws if no directory is loaded', async () => {
      const manager = new FileSystemManager();
      await expect(manager.scanFiles()).rejects.toThrow('No directory loaded');
    });

    it('returns only files with supported extensions', async () => {
      const entries = [
        mockFileEntry('poster1.jpg'),
        mockFileEntry('poster2.png'),
        mockFileEntry('slides.pptx'),
        mockFileEntry('notes.txt'),
        mockFileEntry('readme.md'),
        mockFileEntry('paper.pdf'),
      ];
      const handle = mockDirectoryHandle(entries);
      vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));

      const manager = new FileSystemManager();
      await manager.pickDirectory();
      const files = await manager.scanFiles();

      expect(files).toHaveLength(4);
      const names = files.map((f: ScannedFile) => f.name);
      expect(names).toContain('poster1.jpg');
      expect(names).toContain('poster2.png');
      expect(names).toContain('slides.pptx');
      expect(names).toContain('paper.pdf');
      expect(names).not.toContain('notes.txt');
      expect(names).not.toContain('readme.md');
      vi.unstubAllGlobals();
    });

    it('assigns correct file types', async () => {
      const entries = [
        mockFileEntry('photo.jpeg'),
        mockFileEntry('doc.pdf'),
        mockFileEntry('deck.ppt'),
      ];
      const handle = mockDirectoryHandle(entries);
      vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));

      const manager = new FileSystemManager();
      await manager.pickDirectory();
      const files = await manager.scanFiles();

      const byName = Object.fromEntries(files.map((f: ScannedFile) => [f.name, f]));
      expect(byName['photo.jpeg'].fileType).toBe('image');
      expect(byName['doc.pdf'].fileType).toBe('pdf');
      expect(byName['deck.ppt'].fileType).toBe('document');
      vi.unstubAllGlobals();
    });

    it('skips directory entries', async () => {
      const entries = [
        mockFileEntry('poster.jpg'),
        mockDirectoryEntry('subfolder'),
      ];
      const handle = mockDirectoryHandle(entries as unknown as FileSystemHandle[]);
      vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));

      const manager = new FileSystemManager();
      await manager.pickDirectory();
      const files = await manager.scanFiles();

      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('poster.jpg');
      vi.unstubAllGlobals();
    });

    it('returns empty array for directory with no supported files', async () => {
      const entries = [
        mockFileEntry('readme.md'),
        mockFileEntry('data.csv'),
      ];
      const handle = mockDirectoryHandle(entries);
      vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));

      const manager = new FileSystemManager();
      await manager.pickDirectory();
      const files = await manager.scanFiles();

      expect(files).toHaveLength(0);
      vi.unstubAllGlobals();
    });

    it('populates extension field correctly', async () => {
      const entries = [mockFileEntry('My Poster.JPEG')];
      const handle = mockDirectoryHandle(entries);
      vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));

      const manager = new FileSystemManager();
      await manager.pickDirectory();
      const files = await manager.scanFiles();

      expect(files).toHaveLength(1);
      expect(files[0].extension).toBe('jpeg');
      vi.unstubAllGlobals();
    });
  });

  describe('getFileObjectUrl', () => {
    it('throws if no directory is loaded', async () => {
      const manager = new FileSystemManager();
      await expect(manager.getFileObjectUrl('file.jpg')).rejects.toThrow('No directory loaded');
    });

    it('returns an object URL for a valid file', async () => {
      const fileEntry = mockFileEntry('poster.jpg');
      const handle = mockDirectoryHandle([fileEntry]);
      vi.stubGlobal('showDirectoryPicker', vi.fn().mockResolvedValue(handle));

      const manager = new FileSystemManager();
      await manager.pickDirectory();
      const url = await manager.getFileObjectUrl('poster.jpg');

      expect(url).toMatch(/^blob:/);
      // Clean up
      URL.revokeObjectURL(url);
      vi.unstubAllGlobals();
    });
  });

  describe('revokeObjectUrl', () => {
    it('calls URL.revokeObjectURL', () => {
      const spy = vi.spyOn(URL, 'revokeObjectURL');
      const manager = new FileSystemManager();
      manager.revokeObjectUrl('blob:http://localhost/abc');
      expect(spy).toHaveBeenCalledWith('blob:http://localhost/abc');
    });
  });
});
