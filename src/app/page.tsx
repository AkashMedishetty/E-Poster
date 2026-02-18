'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { abstracts as hardcodedAbstracts } from '@/data/abstracts';
import AbstractCard from '@/components/AbstractCard';
import SearchBar from '@/components/SearchBar';
import ThemeToggle from '@/components/ThemeToggle';
import { usePresentationSync } from '@/hooks/usePresentationSync';
import { useLocalFiles } from '@/contexts/LocalFilesContext';
import { Abstract } from '@/types/abstract';
import { FileSystemManager } from '@/utils/fileSystemManager';
import { getAllInteractions } from '@/utils/interactionStore';
import { exportAsJson, exportAsCsv, triggerDownload } from '@/utils/dataExporter';

// Generate a short random room ID
function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8);
}

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlRoomId = searchParams.get('room');
  
  // Auto-generate room ID if not provided
  useEffect(() => {
    if (!urlRoomId) {
      const newRoomId = generateRoomId();
      router.replace(`/?room=${newRoomId}`);
    }
  }, [urlRoomId, router]);
  
  const roomId = urlRoomId || 'default';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isBrowserSupported, setIsBrowserSupported] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localFiles = useLocalFiles();

  // Determine which abstract list to use
  const activeAbstracts = localFiles.isLoaded ? localFiles.abstracts : hardcodedAbstracts;

  // Polling-based sync for laptop
  const { isConnected, presentAbstract } = usePresentationSync({
    clientType: 'laptop',
    roomId,
    pollingInterval: 3000,
  });

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  // Check browser compatibility on page load
  useEffect(() => {
    setIsBrowserSupported(FileSystemManager.isSupported());
  }, []);

  // Function to auto-send abstract to big screen
  const handleAbstractClick = useCallback(async (abstract: Abstract) => {
    if (isConnected) {
      // For local files, we need to read the file and send as base64
      if (abstract.source === 'local' && abstract.localFileName) {
        try {
          // Get the file URL from the context
          const fileUrl = await localFiles.getFileUrl(abstract.localFileName);
          // Fetch the blob and convert to base64
          const response = await fetch(fileUrl);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result as string;
            await presentAbstract({
              id: abstract.id,
              title: abstract.title,
              author: abstract.author,
              description: abstract.description,
              thumbnail: abstract.thumbnail,
              fileUrl: abstract.fileUrl,
              fileType: abstract.fileType,
              localFileName: abstract.localFileName,
              isLocalFile: true,
              localFileData: base64,
            });
            console.log('Sent local file to big screen:', abstract.title);
            // Revoke the temporary URL
            localFiles.revokeFileUrl(fileUrl);
          };
          reader.readAsDataURL(blob);
          return;
        } catch (error) {
          console.error('Error reading local file:', error);
        }
      }

      // For non-local files or if local file reading fails
      await presentAbstract({
        id: abstract.id,
        title: abstract.title,
        author: abstract.author,
        description: abstract.description,
        thumbnail: abstract.thumbnail,
        fileUrl: abstract.fileUrl,
        fileType: abstract.fileType,
        localFileName: abstract.localFileName,
        isLocalFile: abstract.source === 'local',
      });
      console.log('Sent abstract to big screen:', abstract.title);
    } else {
      console.warn('Not connected to server, cannot send to big screen');
    }
  }, [isConnected, presentAbstract, localFiles]);

  const handleExport = (format: 'csv' | 'json') => {
    const interactions = getAllInteractions();
    if (format === 'json') {
      const content = exportAsJson(interactions);
      triggerDownload(content, 'interactions.json', 'application/json');
    } else {
      const content = exportAsCsv(interactions);
      triggerDownload(content, 'interactions.csv', 'text/csv');
    }
    setShowExportMenu(false);
  };

  const filteredAbstracts = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return activeAbstracts;
    }

    const query = debouncedQuery.toLowerCase();
    return activeAbstracts.filter(abstract =>
      abstract.title.toLowerCase().includes(query) ||
      abstract.author.toLowerCase().includes(query) ||
      abstract.description.toLowerCase().includes(query) ||
      (abstract.abstractId && abstract.abstractId.toLowerCase().includes(query)) ||
      (abstract.regId && abstract.regId.toLowerCase().includes(query))
    );
  }, [debouncedQuery, activeAbstracts]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">E-Poster Abstracts</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Browse and view research posters</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Open Big Screen button */}
              <button
                onClick={() => window.open(`/bigscreen?room=${roomId}`, '_blank')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Open Big Screen
              </button>
              {/* Connection status pill */}
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Room: {roomId}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                  Connecting...
                </span>
              )}
              <ThemeToggle />
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <button
                onClick={localFiles.loadDirectory}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={!isBrowserSupported}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Load Folder
              </button>
              <button
                onClick={localFiles.loadSpreadsheet}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Load Spreadsheet
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Export
                </button>
                {showExportMenu && (
                  <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 z-10 min-w-[120px] overflow-hidden">
                    <button
                      onClick={() => handleExport('csv')}
                      className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      📄 CSV
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      📋 JSON
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {localFiles.isLoaded && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {localFiles.abstracts.length} posters loaded
                </span>
              )}
              {!isBrowserSupported && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Folder loading requires Chrome/Edge
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <SearchBar onSearch={setSearchQuery} />
      </div>

      {/* Abstracts Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {filteredAbstracts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {searchQuery ? 'No abstracts found matching your search.' : 'No abstracts available.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filteredAbstracts.length} of {activeAbstracts.length} abstracts
                {searchQuery && <span className="ml-1">matching &ldquo;{searchQuery}&rdquo;</span>}
              </p>
              {isConnected && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Click any poster to send to big screen
                </p>
              )}
            </div>
            
            <div className="space-y-3">
              {filteredAbstracts.map((abstract) => (
                <AbstractCard 
                  key={abstract.id} 
                  abstract={abstract} 
                  onAutoSend={handleAbstractClick}
                  isWebSocketConnected={isConnected}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
