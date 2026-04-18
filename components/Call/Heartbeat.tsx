import React, { useEffect } from 'react';
import * as Haptics from 'expo-haptics';

/**
 * Heartbeat Component
 * Triggers a dual-pulse haptic feedback at 60bpm.
 * This creates a physical sensation of presence during calls.
 */
export const Heartbeat = ({ isActive }: { isActive: boolean }) => {
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive) {
      // 60bpm = 1 beat per 1000ms
      // A heartbeat is usually "lub-dub" (two pulses)
      interval = setInterval(() => {
        // "Lub"
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // "Dub" (slightly delayed)
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, 150);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive]);

  return null; // Purely functional component
};
