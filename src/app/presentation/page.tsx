'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { abstracts } from '@/data/abstracts';
import Image from 'next/image';

import { Abstract } from '@/types/abstract';

function PresentationContent() {
  const searchParams = useSearchParams();
  const abstractId = searchParams.get('abstract');
  const [abstract, setAbstract] = useState<Abstract | null>(null);

  useEffect(() => {
    // Find the abstract by ID
    if (abstractId) {
      const foundAbstract = abstracts.find(a => a.id === abstractId);
      setAbstract(foundAbstract ?? null);
    }

    // Auto-enter fullscreen
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        console.log('Fullscreen not supported or denied');
      }
    };

    // Small delay to ensure the page is loaded
    const timer = setTimeout(() => {
      enterFullscreen();
    }, 500);

    // Handle escape key to close window
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [abstractId]);

  if (!abstract) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading presentation...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      {/* Back Button - Top Left */}
      <button
        onClick={() => window.close()}
        className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg hover:bg-opacity-70 transition-all flex items-center space-x-2"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span>Back</span>
      </button>

      {/* Full Screen Image */}
      <div className="w-full h-full flex items-center justify-center">
        {abstract.fileType === 'image' ? (
          <Image
            src={abstract.fileUrl}
            alt={abstract.title}
            width={3840}
            height={2160}
            className="max-w-full max-h-full object-contain"
            priority
          />
        ) : abstract.fileType === 'pdf' ? (
          <iframe
            src={abstract.fileUrl}
            className="w-full h-full border-0"
            title={abstract.title}
          />
        ) : (
          <div className="text-center text-white">
            <p className="text-2xl mb-8">File type not supported</p>
            <a
              href={abstract.fileUrl}
              download
              className="inline-flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-lg"
            >
              Download File
            </a>
          </div>
        )}
      </div>

      {/* ESC instruction - Bottom Right */}
      <div className="absolute bottom-4 right-4 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded">
        Press ESC to close
      </div>
    </div>
  );
}

export default function PresentationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading presentation...</div>
      </div>
    }>
      <PresentationContent />
    </Suspense>
  );
}
