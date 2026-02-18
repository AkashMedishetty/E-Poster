'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePresentationSync, SyncPresentationData } from '@/hooks/usePresentationSync';
import FileRenderer from '@/components/FileRenderer';
import OrientationToggle, { useOrientation } from '@/components/OrientationToggle';

// Extended type for presentation data with proper fileType
interface PresentationData {
  id: string;
  title: string;
  author: string;
  description: string;
  thumbnail: string;
  fileUrl: string;
  fileType: 'pdf' | 'image' | 'document';
  localFileName?: string;
  isLocalFile?: boolean;
  localFileData?: string;
}

export default function BigScreenPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white"></div></div>}>
      <BigScreenContent />
    </Suspense>
  );
}

function BigScreenContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room') || 'default';
  
  const [currentAbstract, setCurrentAbstract] = useState<PresentationData | null>(null);
  const [isLocalFile, setIsLocalFile] = useState(false);
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null);
  const { orientation, toggle: toggleOrientation } = useOrientation();

  // Handle presentation changes from polling
  const handlePresentationChange = useCallback((data: SyncPresentationData | null) => {
    console.log('Big screen received presentation:', data);
    
    if (data === null) {
      // Presentation closed
      setCurrentAbstract(null);
      setIsLocalFile(false);
      setLocalFileUrl(null);
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {
          console.log('Cannot exit fullscreen');
        });
      }
      return;
    }

    // Ensure fileType is valid
    const validFileTypes = ['pdf', 'image', 'document'] as const;
    const fileType = validFileTypes.includes(data.fileType as typeof validFileTypes[number]) 
      ? data.fileType as 'pdf' | 'image' | 'document'
      : 'document';

    const normalizedData: PresentationData = {
      id: data.id,
      title: data.title,
      author: data.author,
      description: data.description,
      thumbnail: data.thumbnail,
      fileUrl: data.fileUrl,
      fileType,
      localFileName: data.localFileName,
      isLocalFile: data.isLocalFile,
      localFileData: data.localFileData,
    };

    // New presentation
    setCurrentAbstract(normalizedData);
    setIsLocalFile(!!normalizedData.isLocalFile);
    
    // Handle local file data (base64 encoded)
    if (normalizedData.isLocalFile && normalizedData.localFileData) {
      setLocalFileUrl(normalizedData.localFileData);
    } else {
      setLocalFileUrl(normalizedData.isLocalFile ? normalizedData.fileUrl : null);
    }
    
    // Try to go fullscreen
    setTimeout(() => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          console.log('Fullscreen not allowed');
        });
      }
    }, 500);
  }, []);

  // Polling-based sync for big screen
  const { isConnected, error, lastSync } = usePresentationSync({
    clientType: 'bigscreen',
    roomId,
    onPresentationChange: handlePresentationChange,
    pollingInterval: 1000, // Poll every 1 second for responsive updates
  });

  // Handle ESC key to close presentation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCurrentAbstract(null);
        setIsLocalFile(false);
        setLocalFileUrl(null);
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {
            console.log('Cannot exit fullscreen');
          });
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Show connection status if not connected
  if (!isConnected) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-2">Connecting to E-Poster...</h1>
          <p className="text-gray-300">
            {error || 'Establishing connection to server'}
          </p>
        </div>
      </div>
    );
  }

  // Show waiting screen if no abstract is being presented
  if (!currentAbstract) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-800 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M9 12l2 2 4-4"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">E-Poster Big Screen</h1>
          <p className="text-gray-300 text-lg">Ready to receive presentations</p>
          <p className="text-gray-400 text-sm mt-2">Click an abstract on your laptop to start</p>
          <p className="text-blue-400 text-sm mt-2">Room: {roomId}</p>
          {lastSync && (
            <p className="text-gray-500 text-xs mt-4">
              Connected • Last sync: {new Date(lastSync).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Helper to clear the current abstract
  const handleClose = () => {
    setCurrentAbstract(null);
    setIsLocalFile(false);
    setLocalFileUrl(null);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        console.log('Cannot exit fullscreen');
      });
    }
  };

  // Show the presentation
  // Use FileRenderer for document types (PPTX/PPT), but render images/PDFs directly for full stretch
  if (currentAbstract.fileType === 'document') {
    return (
      <FileRenderer
        abstractEntry={currentAbstract}
        fileObjectUrl={isLocalFile ? localFileUrl : currentAbstract.fileUrl}
        fileType={currentAbstract.fileType}
        orientation={orientation}
        onClose={handleClose}
        onOrientationChange={toggleOrientation}
      />
    );
  }

  // For images and PDFs, render directly with full stretch
  const displayUrl = isLocalFile && localFileUrl ? localFileUrl : currentAbstract.fileUrl;

  return (
    <div className="fixed inset-0 bg-black">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white p-2 rounded-lg hover:bg-opacity-70"
        aria-label="Close"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Orientation toggle */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <OrientationToggle orientation={orientation} onToggle={toggleOrientation} />
      </div>

      {/* Full Screen Content */}
      <div className="w-full h-full">
        {currentAbstract.fileType === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt={currentAbstract.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              transform: orientation === 'portrait' ? 'rotate(90deg)' : 'none',
              transformOrigin: 'center center',
            }}
          />
        ) : currentAbstract.fileType === 'pdf' ? (
          <iframe
            src={displayUrl}
            className="w-full h-full border-0"
            title={currentAbstract.title}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            <div className="text-center">
              <p className="text-2xl mb-8">File type not supported</p>
              <a
                href={displayUrl}
                download
                className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-lg"
              >
                Download File
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
