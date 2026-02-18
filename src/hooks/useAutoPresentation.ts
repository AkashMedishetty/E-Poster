'use client';

import { useEffect, useState } from 'react';

interface UseAutoPresentationOptions {
  abstractId: string;
  onStartPresentation: () => void;
}

export function useAutoPresentation({ abstractId, onStartPresentation }: UseAutoPresentationOptions) {
  const [isSecondScreenDetected, setIsSecondScreenDetected] = useState(false);

  useEffect(() => {
    // Check for multiple screens and open presentation on primary screen (big screen)
    const checkAndOpenOnPrimaryScreen = () => {
      try {
        // Check if we have multiple screens
        const hasMultipleScreens = window.screen && window.screen.width < window.screen.availWidth;
        
        if (hasMultipleScreens) {
          setIsSecondScreenDetected(true);
          
          // Open big screen page in a new window on the PRIMARY screen (big screen)
          const baseUrl = window.location.origin;
          const bigScreenUrl = `${baseUrl}/bigscreen`;
          
          // Open new window on PRIMARY screen (big screen) - position at 0,0 for primary
          const presentationWindow = window.open(
            bigScreenUrl,
            'bigscreen',
            `width=3840,height=2160,left=0,top=0,fullscreen=yes,scrollbars=no,resizable=no,toolbar=no,menubar=no,location=no,status=no`
          );
          
          if (presentationWindow) {
            // Focus the new window
            presentationWindow.focus();
            
            // Move window to primary screen (0,0) if it didn't open there
            setTimeout(() => {
              try {
                presentationWindow.moveTo(0, 0);
                presentationWindow.resizeTo(3840, 2160);
              } catch (e) {
                console.log('Cannot move window:', e);
              }
            }, 100);
            
            // Try to make it fullscreen
            setTimeout(() => {
              if (presentationWindow.document.documentElement.requestFullscreen) {
                presentationWindow.document.documentElement.requestFullscreen().catch(() => {
                  console.log('Fullscreen not allowed');
                });
              }
            }, 1000);
          }
          
          return true;
        }
      } catch (e) {
        console.log('Primary screen presentation error:', e);
      }
      
      return false;
    };

    // Auto-start presentation on primary screen if detected
    const timer = setTimeout(() => {
      checkAndOpenOnPrimaryScreen();
    }, 1000);

    return () => clearTimeout(timer);
  }, [abstractId, onStartPresentation]);

  return { isSecondScreenDetected };
}
