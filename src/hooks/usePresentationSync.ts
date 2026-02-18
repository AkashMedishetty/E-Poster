import { useEffect, useRef, useState, useCallback } from 'react';

export interface SyncPresentationData {
  id: string;
  title: string;
  author: string;
  description: string;
  thumbnail: string;
  fileUrl: string;
  fileType: string;
  localFileName?: string;
  isLocalFile?: boolean;
  localFileData?: string; // Base64 encoded file data for local files
}

interface UsePresentationSyncOptions {
  clientType: 'laptop' | 'bigscreen';
  roomId?: string; // Room ID for multi-display support
  onPresentationChange?: (data: SyncPresentationData | null) => void;
  pollingInterval?: number; // in milliseconds
}

interface SyncState {
  isConnected: boolean;
  error: string | null;
  lastSync: number | null;
}

export function usePresentationSync({
  clientType,
  roomId = 'default',
  onPresentationChange,
  pollingInterval = 1500, // Default 1.5 seconds for good balance
}: UsePresentationSyncOptions) {
  const [state, setState] = useState<SyncState>({
    isConnected: true, // Start optimistically connected
    error: null,
    lastSync: null,
  });
  
  const versionRef = useRef<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const onPresentationChangeRef = useRef(onPresentationChange);
  const consecutiveErrorsRef = useRef(0);
  const maxConsecutiveErrors = 5;

  // Keep callback ref current
  useEffect(() => {
    onPresentationChangeRef.current = onPresentationChange;
  }, [onPresentationChange]);

  // Send presentation to big screen (laptop only)
  const presentAbstract = useCallback(async (data: SyncPresentationData) => {
    try {
      const response = await fetch('/api/presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'present_abstract',
          data,
          room: roomId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send presentation');
      }

      const result = await response.json();
      versionRef.current = result.version;
      consecutiveErrorsRef.current = 0;
      
      if (mountedRef.current) {
        setState(prev => ({ ...prev, isConnected: true, error: null }));
      }
      
      console.log(`[${clientType}] Presentation sent:`, data.title, `(room: ${roomId})`);
      return true;
    } catch (error) {
      console.error(`[${clientType}] Failed to send presentation:`, error);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, error: 'Failed to send presentation' }));
      }
      return false;
    }
  }, [clientType, roomId]);

  // Close presentation (laptop only)
  const closePresentation = useCallback(async () => {
    try {
      const response = await fetch('/api/presentation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'close_presentation', room: roomId }),
      });

      if (!response.ok) {
        throw new Error('Failed to close presentation');
      }

      const result = await response.json();
      versionRef.current = result.version;
      consecutiveErrorsRef.current = 0;
      
      console.log(`[${clientType}] Presentation closed`);
      return true;
    } catch (error) {
      console.error(`[${clientType}] Failed to close presentation:`, error);
      return false;
    }
  }, [clientType, roomId]);

  // Poll for updates (big screen only, but laptop can also use for status)
  const pollForUpdates = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      // Add timestamp to prevent any caching
      const response = await fetch(`/api/presentation?version=${versionRef.current}&room=${roomId}&t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch presentation state');
      }

      const result = await response.json();
      consecutiveErrorsRef.current = 0;

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null,
          lastSync: Date.now(),
        }));
      }

      // Only process if there's a change
      if (result.changed) {
        versionRef.current = result.version;
        console.log(`[${clientType}] Received update, version:`, result.version);
        onPresentationChangeRef.current?.(result.abstract);
      }
    } catch (error) {
      consecutiveErrorsRef.current++;
      console.error(`[${clientType}] Polling error (${consecutiveErrorsRef.current}/${maxConsecutiveErrors}):`, error);
      
      if (mountedRef.current) {
        // Only show disconnected after multiple consecutive errors
        if (consecutiveErrorsRef.current >= maxConsecutiveErrors) {
          setState(prev => ({
            ...prev,
            isConnected: false,
            error: 'Connection lost. Retrying...',
          }));
        }
      }
    }
  }, [clientType, roomId]);

  // Start/stop polling based on client type
  useEffect(() => {
    mountedRef.current = true;

    // Initial poll to get current state and establish connection
    pollForUpdates();

    // Big screen polls continuously, laptop polls less frequently just for status
    const interval = clientType === 'bigscreen' ? pollingInterval : pollingInterval * 2;
    
    pollingRef.current = setInterval(pollForUpdates, interval);

    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [clientType, pollingInterval, pollForUpdates]);

  // Manual refresh
  const refresh = useCallback(() => {
    pollForUpdates();
  }, [pollForUpdates]);

  return {
    isConnected: state.isConnected,
    error: state.error,
    lastSync: state.lastSync,
    presentAbstract,
    closePresentation,
    refresh,
  };
}
