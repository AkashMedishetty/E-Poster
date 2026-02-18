/**
 * Type declarations for the File System Access API.
 * These APIs are available in Chrome and Edge but not yet in the standard TypeScript DOM lib.
 */

interface FileSystemDirectoryHandle {
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>;
}

interface Window {
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
}
