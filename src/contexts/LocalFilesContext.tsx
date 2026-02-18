'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import type { Abstract } from '@/types/abstract';
import { FileSystemManager } from '@/utils/fileSystemManager';
import type { ScannedFile } from '@/utils/fileSystemManager';
import { parseSpreadsheet } from '@/utils/spreadsheetParser';
import type { SpreadsheetRow } from '@/utils/spreadsheetParser';
import { generateAbstractList } from '@/utils/abstractListGenerator';
import { parseFilename } from '@/utils/filenameParser';

interface LocalFilesContextValue {
  isLoaded: boolean;
  directoryHandle: FileSystemDirectoryHandle | null;
  abstracts: Abstract[];
  fileSystemManager: FileSystemManager | null;
  spreadsheetRows: SpreadsheetRow[] | null;
  loadDirectory: () => Promise<void>;
  loadSpreadsheet: () => Promise<void>;
  getFileUrl: (fileName: string) => Promise<string>;
  revokeFileUrl: (url: string) => void;
}

const LocalFilesContext = createContext<LocalFilesContextValue | undefined>(
  undefined
);

export function LocalFilesProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [abstracts, setAbstracts] = useState<Abstract[]>([]);
  const [spreadsheetRows, setSpreadsheetRows] = useState<SpreadsheetRow[] | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);

  const fsmRef = useRef<FileSystemManager | null>(null);
  const scannedFilesRef = useRef<ScannedFile[]>([]);

  /**
   * Rebuilds the abstract list from the current scanned files and spreadsheet rows.
   */
  const rebuildAbstracts = useCallback(
    (files: ScannedFile[], rows: SpreadsheetRow[] | null) => {
      const parsedFilenames = files.map((f) => parseFilename(f.name));
      const list = generateAbstractList(files, rows, parsedFilenames);
      setAbstracts(list);
    },
    []
  );

  /**
   * Prompt the user to pick a local directory, scan it for poster files,
   * and generate the abstract list.
   */
  const loadDirectory = useCallback(async () => {
    const fsm = new FileSystemManager();
    const picked = await fsm.pickDirectory();
    if (!picked) return;

    const files = await fsm.scanFiles();
    console.log(`[LocalFiles] Scanned ${files.length} files:`, files.map(f => f.name));
    
    fsmRef.current = fsm;
    scannedFilesRef.current = files;

    setDirectoryHandle(fsm.getDirectoryHandle());

    rebuildAbstracts(files, spreadsheetRows);
    setIsLoaded(true);
  }, [spreadsheetRows, rebuildAbstracts]);

  /**
   * Prompt the user to select a spreadsheet file, parse it,
   * and regenerate the abstract list if files are already loaded.
   */
  const loadSpreadsheet = useCallback(async () => {
    let file: File | undefined;

    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as unknown as {
          showOpenFilePicker: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
        }).showOpenFilePicker({
          types: [
            {
              description: 'Spreadsheet files',
              accept: {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'text/csv': ['.csv'],
              },
            },
          ],
          multiple: false,
        });
        file = await handle.getFile();
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        throw err;
      }
    } else {
      // Fallback: use a hidden file input
      file = await new Promise<File | undefined>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.csv';
        input.onchange = () => resolve(input.files?.[0]);
        input.click();
      });
    }

    if (!file) return;

    const rows = await parseSpreadsheet(file);
    setSpreadsheetRows(rows);

    // Regenerate abstracts if files are already loaded
    if (scannedFilesRef.current.length > 0) {
      rebuildAbstracts(scannedFilesRef.current, rows);
    }
  }, [rebuildAbstracts]);

  /**
   * Read a file from the loaded directory and return an object URL.
   */
  const getFileUrl = useCallback(async (fileName: string): Promise<string> => {
    if (!fsmRef.current) {
      throw new Error('No directory loaded. Call loadDirectory() first.');
    }
    return fsmRef.current.getFileObjectUrl(fileName);
  }, []);

  /**
   * Revoke a previously created object URL to free memory.
   */
  const revokeFileUrl = useCallback((url: string) => {
    if (fsmRef.current) {
      fsmRef.current.revokeObjectUrl(url);
    }
  }, []);

  return (
    <LocalFilesContext.Provider
      value={{
        isLoaded,
        directoryHandle,
        abstracts,
        fileSystemManager: fsmRef.current,
        spreadsheetRows,
        loadDirectory,
        loadSpreadsheet,
        getFileUrl,
        revokeFileUrl,
      }}
    >
      {children}
    </LocalFilesContext.Provider>
  );
}

export function useLocalFiles() {
  const context = useContext(LocalFilesContext);
  if (context === undefined) {
    throw new Error('useLocalFiles must be used within a LocalFilesProvider');
  }
  return context;
}
