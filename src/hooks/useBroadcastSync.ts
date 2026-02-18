import { useEffect, useRef, useCallback, useState } from 'react';

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
  localFileData?: string;
}

interface UseBroadcastSyncOptions {
  roomId: string;
  clientType: 'laptop' | 'bigscreen';
  onPresentationChange?: (data: SyncPresentationData | null) => void;
}

export function useBroadcastSync({
  roomId,
  clientType,
  onPresentationChange,
}: UseBroadcastSyncOptions) {
  const [isConnected, setIsConnected] = useState(true);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onPresentationChangeRef = useRef(onPresentationChange);

  // Keep callback ref current
  useEffect(() => {
    onPresentationChangeRef.current = onPresentationChange;
  }, [onPresentationChange]);

  // Initialize BroadcastChannel
  useEffect(() => {
    const channelName = `eposter-${roomId}`;
    console.log(`[${clientType}] Opening BroadcastChannel: ${channelName}`);
    
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, data } = event.data;
      console.log(`[${clientType}] Received broadcast:`, type);

      if (type === 'present_abstract') {
        onPresentationChangeRef.current?.(data);
      } else if (type === 'close_presentation') {
        onPresentationChangeRef.current?.(null);
      }
    };

    setIsConnected(true);

    // If bigscreen, request current state from laptop
    if (clientType === 'bigscreen') {
      channel.postMessage({ type: 'request_state' });
    }

    return () => {
      console.log(`[${clientType}] Closing BroadcastChannel`);
      channel.close();
      channelRef.current = null;
    };
  }, [roomId, clientType]);

  // Send presentation (laptop only)
  const presentAbstract = useCallback((data: SyncPresentationData) => {
    if (channelRef.current) {
      console.log(`[${clientType}] Broadcasting presentation:`, data.title);
      channelRef.current.postMessage({ type: 'present_abstract', data });
      return true;
    }
    return false;
  }, [clientType]);

  // Close presentation (laptop only)
  const closePresentation = useCallback(() => {
    if (channelRef.current) {
      console.log(`[${clientType}] Broadcasting close`);
      channelRef.current.postMessage({ type: 'close_presentation' });
      return true;
    }
    return false;
  }, [clientType]);

  return {
    isConnected,
    presentAbstract,
    closePresentation,
  };
}
