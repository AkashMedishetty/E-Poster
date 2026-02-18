'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Abstract } from '@/types/abstract';

interface PresentationModeProps {
  abstract: Abstract;
  onClose: () => void;
}

export default function PresentationMode({ abstract, onClose }: PresentationModeProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Auto-enter fullscreen when component mounts
    const enterFullscreen = async () => {
      try {
        // Try different fullscreen methods for better browser compatibility
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
      } catch (error) {
        console.log('Fullscreen not supported or denied:', error);
        // If fullscreen fails, we'll still show the presentation mode
        setIsFullscreen(false);
      }
    };

    // Small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      enterFullscreen();
    }, 100);

    // Handle fullscreen change events
    const handleFullscreenChange = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      };
      setIsFullscreen(!!(
        document.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      ));
    };

    // Handle escape key to exit presentation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Add event listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

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
        
        {/* Fallback message if content doesn't load */}
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100" style={{ display: 'none' }} id="fallback-message">
          <div className="text-center text-gray-600">
            <p className="text-xl mb-4">Content loading...</p>
            <p className="text-sm">If this persists, try refreshing the page</p>
          </div>
        </div>
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
