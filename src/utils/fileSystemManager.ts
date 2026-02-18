import { mapExtensionToType, type PosterFileType } from './fileTypeMapper';

export interface ScannedFile {
  name: string;
  extension: string;
  fileType: PosterFileType;
  handle: FileSystemFileHandle;
}

const SUPPORTED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf', 'ppt', 'pptx']);

/**
 * Extracts the lowercase extension from a filename.
 * Returns an empty string if no extension is found.
 */
export function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1 || dotIndex === filename.length - 1) return '';
  return filename.slice(dotIndex + 1).toLowerCase();
}

/**
 * Checks whether a given extension is in the supported set.
 */
export function isSupportedExtension(extension: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extension.toLowerCase());
}

export class FileSystemManager {
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  /**
   * Check if the File System Access API is available in the current browser.
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * Prompt the user to select a local directory.
   * Returns true if a directory was successfully selected, false if the user cancelled.
   */
  async pickDirectory(): Promise<boolean> {
    try {
      this.directoryHandle = await window.showDirectoryPicker();
      return true;
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Whether a directory has been loaded via pickDirectory().
   */
  isDirectoryLoaded(): boolean {
    return this.directoryHandle !== null;
  }

  /**
   * Returns the current directory handle, or null if none is loaded.
   */
  getDirectoryHandle(): FileSystemDirectoryHandle | null {
    return this.directoryHandle;
  }

  /**
   * Scan the loaded directory and return all files with supported extensions.
   * Recursively scans subfolders.
   * Skips unsupported file types without error.
   * Throws if no directory has been loaded.
   */
  async scanFiles(): Promise<ScannedFile[]> {
    if (!this.directoryHandle) {
      throw new Error('No directory loaded. Call pickDirectory() first.');
    }

    const files: ScannedFile[] = [];
    
    // Recursive function to scan a directory
    const scanDirectory = async (dirHandle: FileSystemDirectoryHandle) => {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
          // Recursively scan subdirectories
          await scanDirectory(entry as FileSystemDirectoryHandle);
        } else if (entry.kind === 'file') {
          const ext = getExtension(entry.name);
          if (!isSupportedExtension(ext)) continue;

          const fileType = mapExtensionToType(ext);
          if (!fileType) continue;

          files.push({
            name: entry.name,
            extension: ext,
            fileType,
            handle: entry as FileSystemFileHandle,
          });
        }
      }
    };

    await scanDirectory(this.directoryHandle);
    return files;
  }

  /**
   * Read a file by name from the loaded directory (including subfolders) and return an object URL.
   * The caller is responsible for revoking the URL when done.
   */
  async getFileObjectUrl(fileName: string): Promise<string> {
    if (!this.directoryHandle) {
      throw new Error('No directory loaded. Call pickDirectory() first.');
    }

    // Try to find the file in the directory tree
    const findFile = async (dirHandle: FileSystemDirectoryHandle): Promise<FileSystemFileHandle | null> => {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name === fileName) {
          return entry as FileSystemFileHandle;
        } else if (entry.kind === 'directory') {
          const found = await findFile(entry as FileSystemDirectoryHandle);
          if (found) return found;
        }
      }
      return null;
    };

    const fileHandle = await findFile(this.directoryHandle);
    if (!fileHandle) {
      throw new Error(`File not found: ${fileName}`);
    }
    
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  }

  /**
   * Revoke a previously created object URL to free memory.
   */
  revokeObjectUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}
