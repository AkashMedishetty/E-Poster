'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Abstract } from '@/types/abstract';
import { getInteractions } from '@/utils/interactionStore';

interface AbstractCardProps {
  abstract: Abstract;
  onAutoSend?: (abstract: Abstract) => void;
  isWebSocketConnected?: boolean;
}

function FileTypeBadge({ fileType, fileName }: { fileType: string; fileName?: string }) {
  const isPptx = fileName?.toLowerCase().endsWith('.pptx');
  const isPpt = fileName?.toLowerCase().endsWith('.ppt');

  let label = fileType.toUpperCase();
  let colorClass = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';

  if (fileType === 'image') {
    label = 'IMAGE';
    colorClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  } else if (fileType === 'pdf') {
    label = 'PDF';
    colorClass = 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  } else if (isPptx) {
    label = 'PPTX';
    colorClass = 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
  } else if (isPpt) {
    label = 'PPT';
    colorClass = 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide ${colorClass}`}>
      {label}
    </span>
  );
}

export default function AbstractCard({ abstract, onAutoSend, isWebSocketConnected }: AbstractCardProps) {
  const [likeCount, setLikeCount] = useState(0);
  const isLocal = abstract.source === 'local';

  useEffect(() => {
    const { likes } = getInteractions(abstract.id);
    setLikeCount(likes);
  }, [abstract.id]);

  const handleClick = (e: React.MouseEvent) => {
    if (isWebSocketConnected && onAutoSend) {
      e.preventDefault();
      onAutoSend(abstract);
    }
  };

  // Simple icon-based thumbnail for local files (no loading)
  const renderThumbnail = () => {
    if (isLocal) {
      const iconColor = abstract.fileType === 'image' 
        ? 'from-emerald-400 to-emerald-600'
        : abstract.fileType === 'pdf' 
        ? 'from-red-400 to-red-600' 
        : 'from-orange-400 to-orange-600';
      
      const icon = abstract.fileType === 'image' ? (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ) : (
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
      
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center`}>
            {icon}
          </div>
        </div>
      );
    }

    return (
      <Image
        src={abstract.thumbnail}
        alt={abstract.title}
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-300"
        sizes="(max-width: 768px) 100vw, 200px"
      />
    );
  };

  return (
    <Link
      href={`/poster/${abstract.id}`}
      className="group block"
      onClick={handleClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-200 dark:border-gray-700 p-4 group-hover:border-blue-300 dark:group-hover:border-blue-600">
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="relative h-28 w-44 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
            {renderThumbnail()}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <FileTypeBadge fileType={abstract.fileType} fileName={abstract.localFileName} />
              {abstract.abstractId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  {abstract.abstractId}
                </span>
              )}
              {abstract.regId && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                  {abstract.regId}
                </span>
              )}
              {isLocal && !abstract.hasFile && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  NO FILE
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {abstract.title}
            </h3>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
              {abstract.author}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {abstract.description}
            </p>

            {likeCount > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 px-2 py-0.5 rounded-full">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                <span>{likeCount}</span>
              </div>
            )}
          </div>
          
          {/* Right side indicator */}
          <div className="flex-shrink-0 flex items-center self-center">
            {isWebSocketConnected ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            ) : (
              <svg
                className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
