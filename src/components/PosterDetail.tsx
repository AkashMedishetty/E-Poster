'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Abstract } from '@/types/abstract';
import PresentationMode from './PresentationMode';
import ManualPresentationMode from './ManualPresentationMode';
import FileRenderer from './FileRenderer';
import InteractionPanel from './InteractionPanel';
import OrientationToggle, { useOrientation } from './OrientationToggle';
import { useAutoPresentation } from '@/hooks/useAutoPresentation';
import { usePresentationSync } from '@/hooks/usePresentationSync';
import { useLocalFiles } from '@/contexts/LocalFilesContext';
import { preloadImage } from '@/utils/cache';
import ThemeToggle from './ThemeToggle';

interface PosterDetailProps {
  abstract: Abstract;
}

export default function PosterDetail({ abstract }: PosterDetailProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>}>
      <PosterDetailContent abstract={abstract} />
    </Suspense>
  );
}

function PosterDetailContent({ abstract }: PosterDetailProps) {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room') || 'default';
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isManualPresentation, setIsManualPresentation] = useState(false);
  const [isFileRendererOpen, setIsFileRendererOpen] = useState(false);

  // Local file state
  const [fileObjectUrl, setFileObjectUrl] = useState<string | null>(null);
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const fileObjectUrlRef = useRef<string | null>(null);

  const { getFileUrl, revokeFileUrl } = useLocalFiles();
  const { orientation, toggle: toggleOrientationFn } = useOrientation();

  const isLocalFile = abstract.source === 'local';

  // Polling-based sync for laptop
  const { isConnected, presentAbstract } = usePresentationSync({
    clientType: 'laptop',
    roomId,
    pollingInterval: 3000,
  });

  // Auto-presentation hook
  const { isSecondScreenDetected } = useAutoPresentation({
    abstractId: abstract.id,
    onStartPresentation: () => {},
  });

  // Preload images for hardcoded abstracts
  useEffect(() => {
    if (!isLocalFile) {
      preloadImage(abstract.thumbnail);
      if (abstract.fileType === 'image') {
        preloadImage(abstract.fileUrl);
      }
    }
  }, [abstract.thumbnail, abstract.fileUrl, abstract.fileType, isLocalFile]);

  // Load file URL on demand for local files
  useEffect(() => {
    if (!isLocalFile || !abstract.localFileName) return;

    let cancelled = false;

    const loadFile = async () => {
      try {
        const url = await getFileUrl(abstract.localFileName!);
        if (!cancelled) {
          setFileObjectUrl(url);
          fileObjectUrlRef.current = url;
          setFileLoadError(null);
        } else {
          // If cancelled before we could set it, revoke immediately
          revokeFileUrl(url);
        }
      } catch {
        if (!cancelled) {
          setFileLoadError(
            'Could not load file. The folder permission may have been lost. Please re-select the folder.'
          );
        }
      }
    };

    loadFile();

    // Revoke object URL on unmount (Requirement 4.3)
    return () => {
      cancelled = true;
      if (fileObjectUrlRef.current) {
        revokeFileUrl(fileObjectUrlRef.current);
        fileObjectUrlRef.current = null;
      }
    };
  }, [isLocalFile, abstract.localFileName, getFileUrl, revokeFileUrl]);

  const handleFileLoad = () => {
    setIsLoading(false);
  };

  /**
   * Send file data to big screen via polling API.
   * For local files, reads the file as base64 and sends it.
   * For hardcoded files, sends the fileUrl directly.
   */
  const handleSendToBigScreen = useCallback(async () => {
    if (!isConnected) return;

    if (isLocalFile && fileObjectUrl) {
      try {
        // Fetch the object URL to get the blob, then convert to base64
        const response = await fetch(fileObjectUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
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
        };
        reader.readAsDataURL(blob);
      } catch {
        console.error('Failed to read local file for big screen');
      }
    } else {
      await presentAbstract({
        id: abstract.id,
        title: abstract.title,
        author: abstract.author,
        description: abstract.description,
        thumbnail: abstract.thumbnail,
        fileUrl: abstract.fileUrl,
        fileType: abstract.fileType,
      });
    }
  }, [isConnected, isLocalFile, fileObjectUrl, presentAbstract, abstract]);

  // --- Presentation modes for hardcoded abstracts ---
  if (isPresentationMode && !isLocalFile) {
    return (
      <PresentationMode
        abstract={abstract}
        onClose={() => setIsPresentationMode(false)}
      />
    );
  }

  if (isManualPresentation && !isLocalFile) {
    return (
      <ManualPresentationMode
        abstract={abstract}
        onClose={() => setIsManualPresentation(false)}
      />
    );
  }

  // --- FileRenderer for local files (full-screen view) ---
  if (isFileRendererOpen && isLocalFile) {
    return (
      <FileRenderer
        abstractEntry={abstract}
        fileObjectUrl={fileObjectUrl}
        fileType={abstract.fileType}
        orientation={orientation}
        onClose={() => setIsFileRendererOpen(false)}
        onOrientationChange={toggleOrientationFn}
      />
    );
  }

  // --- File content rendering for the detail view ---
  const renderFileContent = () => {
    // Error state for local files
    if (isLocalFile && fileLoadError) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{fileLoadError}</p>
          </div>
        </div>
      );
    }

    // Loading state for local files
    if (isLocalFile && !fileObjectUrl) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    // For local files, use the object URL; for hardcoded, use fileUrl
    const displayUrl = isLocalFile ? fileObjectUrl! : abstract.fileUrl;

    switch (abstract.fileType) {
      case 'pdf':
        return (
          <div className="w-full h-full">
            {isLoading && (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            )}
            <iframe
              src={displayUrl}
              className="w-full h-screen border-0"
              onLoad={handleFileLoad}
              title={abstract.title}
            />
          </div>
        );
      case 'image':
        return (
          <div className="flex justify-center">
            {isLocalFile ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayUrl}
                alt={abstract.title}
                className="max-w-full h-auto rounded-lg shadow-lg"
                style={{ maxHeight: '600px' }}
                onLoad={handleFileLoad}
              />
            ) : (
              <Image
                src={displayUrl}
                alt={abstract.title}
                width={800}
                height={600}
                className="max-w-full h-auto rounded-lg shadow-lg"
                onLoad={handleFileLoad}
              />
            )}
          </div>
        );
      case 'document': {
        const localName = abstract.localFileName || '';
        const isPptx = localName.toLowerCase().endsWith('.pptx');
        const isLegacyPpt = localName.toLowerCase().endsWith('.ppt');

        if (isPptx) {
          return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                </svg>
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">PowerPoint Presentation</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{localName}</p>
              <button
                onClick={() => setIsFileRendererOpen(true)}
                disabled={!fileObjectUrl}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Slideshow
              </button>
            </div>
          );
        }

        if (isLegacyPpt) {
          return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">Legacy PPT Format</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Only PPTX is supported for in-app viewing</p>
              {isLocalFile && fileObjectUrl && (
                <a
                  href={fileObjectUrl}
                  download={abstract.localFileName}
                  className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg shadow-md hover:bg-gray-700 transition-colors font-medium"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download File
                </a>
              )}
            </div>
          );
        }

        // Unknown document type fallback
        return (
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">File type not supported for preview</p>
            {isLocalFile && fileObjectUrl ? (
              <a
                href={fileObjectUrl}
                download={abstract.localFileName}
                className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Download File
              </a>
            ) : (
              <a
                href={abstract.fileUrl}
                download
                className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Download File
              </a>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: navigation + actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Link>

              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700"></div>

              {isLocalFile ? (
                <button
                  onClick={() => setIsFileRendererOpen(true)}
                  disabled={!fileObjectUrl}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Full Screen
                </button>
              ) : (
                <button
                  onClick={() => setIsPresentationMode(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Present
                </button>
              )}

              {isLocalFile && (
                <OrientationToggle
                  orientation={orientation}
                  onToggle={toggleOrientationFn}
                />
              )}
            </div>

            {/* Right: connection + big screen + theme */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                  Connecting...
                </span>
              )}
              <button
                onClick={handleSendToBigScreen}
                disabled={!isConnected}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm ${
                  isConnected
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send to Screen
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Abstract Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              {isLocalFile ? (
                fileObjectUrl && abstract.fileType === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fileObjectUrl}
                    alt={abstract.title}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )
              ) : (
                <Image
                  src={abstract.thumbnail}
                  alt={abstract.title}
                  fill
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {abstract.title}
              </h1>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                {abstract.author}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                {abstract.description}
              </p>
            </div>
          </div>
        </div>

        {/* File Content + InteractionPanel side by side */}
        <div className="flex gap-6">
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {renderFileContent()}
          </div>

          {/* InteractionPanel alongside the viewer */}
          <div className="flex-shrink-0 w-80">
            <InteractionPanel abstractId={abstract.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
