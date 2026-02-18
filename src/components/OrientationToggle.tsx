'use client';

import React, { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'eposter-orientation';

export type OrientationMode = 'landscape' | 'portrait';

export interface OrientationToggleProps {
  orientation: OrientationMode;
  onToggle: (newOrientation: OrientationMode) => void;
}

/**
 * Toggle the orientation value.
 * Exported for testability (Property 8: toggle is its own inverse).
 */
export function toggleOrientation(current: OrientationMode): OrientationMode {
  return current === 'landscape' ? 'portrait' : 'landscape';
}

/**
 * Read orientation from localStorage. Returns 'landscape' if not set or invalid.
 */
export function readOrientationFromStorage(): OrientationMode {
  if (typeof window === 'undefined') return 'landscape';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'landscape' || stored === 'portrait') return stored;
  return 'landscape';
}

/**
 * Write orientation to localStorage.
 */
export function writeOrientationToStorage(orientation: OrientationMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, orientation);
}

/**
 * Hook that manages orientation state with localStorage persistence.
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<OrientationMode>('landscape');

  // Read initial value from localStorage on mount
  useEffect(() => {
    setOrientation(readOrientationFromStorage());
  }, []);

  const toggle = useCallback((newOrientation: OrientationMode) => {
    setOrientation(newOrientation);
    writeOrientationToStorage(newOrientation);
  }, []);

  return { orientation, toggle } as const;
}

/**
 * Toggle button switching between landscape and portrait orientation.
 * Persists the selected orientation to localStorage.
 */
export default function OrientationToggle({ orientation, onToggle }: OrientationToggleProps) {
  const handleClick = () => {
    const next = toggleOrientation(orientation);
    writeOrientationToStorage(next);
    onToggle(next);
  };

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      aria-label={`Switch to ${orientation === 'landscape' ? 'portrait' : 'landscape'} mode`}
      title={`Current: ${orientation}. Click to switch.`}
    >
      {orientation === 'landscape' ? (
        // Landscape icon (wide rectangle)
        <svg
          className="w-5 h-5 text-gray-700 dark:text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={2} />
        </svg>
      ) : (
        // Portrait icon (tall rectangle)
        <svg
          className="w-5 h-5 text-gray-700 dark:text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="5" y="2" width="14" height="20" rx="2" strokeWidth={2} />
        </svg>
      )}
    </button>
  );
}
