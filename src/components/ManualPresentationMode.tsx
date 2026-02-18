'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Abstract } from '@/types/abstract';

interface ManualPresentationModeProps {
  abstract: Abstract;
  onClose: () => void;
}

export default function ManualPresentationMode({ abstract, onClose }: ManualPresentationModeProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    // Handle escape key to exit presentation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const element = document.documentElement;
        
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if ('webkitRequestFullscreen' in element) {
          await (element as HTMLElement & { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        } else if ('mozRequestFullScreen' in element) {
          await (element as HTMLElement & { mozRequestFullScreen: () => Promise<void> }).mozRequestFullScreen();
        } else if ('msRequestFullscreen' in element) {
          await (element as HTMLElement & { msRequestFullscreen: () => Promise<void> }).msRequestFullscreen();
        }
        
        setIsFullscreen(true);
        setShowInstructions(false);
      } else {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void>;
          mozCancelFullScreen?: () => Promise<void>;
          msExitFullscreen?: () => Promise<void>;
        };
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        
        setIsFullscreen(false);
      }
    } catch (error) {
      console.log('Fullscreen error:', error);
    }
  };

  const renderFileContent = () => {
    switch (abstract.fileType) {
      case 'pdf':
        return (
          <iframe
            src={abstract.fileUrl}
            className="w-full h-full border-0"
            title={abstract.title}
          />
        );
      case 'image':
        return (
          <div className="flex items-center justify-center h-full">
            <Image
              src={abstract.fileUrl}
              alt={abstract.title}
              fill
              className="object-contain"
            />
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-white">
              <p className="text-2xl mb-8">File type not supported for presentation</p>
              <a
                href={abstract.fileUrl}
                download
                className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-lg"
              >
                Download File
              </a>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Instructions Overlay */}
      {showInstructions && (
        <div className="absolute inset-0 bg-black bg-opacity-90 z-10 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-2xl mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Presentation Mode</h2>
            <div className="space-y-4 text-gray-700">
              <p><strong>To display on your big screen:</strong></p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Make sure your big screen is set as primary display</li>
                <li>Close this browser window</li>
                <li>Open a new browser window on your big screen</li>
                <li>Navigate to the same URL</li>
                <li>Click on this abstract again</li>
              </ol>
              <p className="text-sm text-gray-600 mt-4">
                <strong>Alternative:</strong> Drag this browser window to your big screen, then press F11 for fullscreen
              </p>
            </div>
            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowInstructions(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Continue Anyway
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{abstract.title}</h1>
          <p className="text-gray-300">by {abstract.author}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-400">
            {isFullscreen ? 'Fullscreen Active' : 'Press F11 for fullscreen'} • Press ESC to exit
          </div>
          <button
            onClick={toggleFullscreen}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Exit Presentation
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white relative">
        {renderFileContent()}
      </div>

      {/* Footer with abstract info */}
      <div className="bg-gray-900 text-white p-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm text-gray-300 line-clamp-2">
            {abstract.description}
          </p>
        </div>
      </div>
    </div>
  );
}
