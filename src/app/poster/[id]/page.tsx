'use client';

import { use } from 'react';
import { useLocalFiles } from '@/contexts/LocalFilesContext';
import { abstracts } from '@/data/abstracts';
import PosterDetail from '@/components/PosterDetail';
import Link from 'next/link';

interface PosterPageProps {
  params: Promise<{ id: string }>;
}

export default function PosterPage({ params }: PosterPageProps) {
  const { id } = use(params);
  const { abstracts: localAbstracts, isLoaded } = useLocalFiles();

  // Check local abstracts first (if loaded), then fall back to hardcoded
  const abstract =
    (isLoaded ? localAbstracts.find((a) => a.id === id) : undefined) ??
    abstracts.find((a) => a.id === id);

  if (!abstract) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Poster Not Found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The poster you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Back to List
        </Link>
      </div>
    );
  }

  return <PosterDetail abstract={abstract} />;
}
