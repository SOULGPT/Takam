import { useCallback } from 'react';
import { useCallStore } from '../store/useCallStore';

/**
 * Web-safe stub for useWebRTC.
 * Native implementation is in useWebRTC.native.ts
 */
export function useWebRTC() {
  const { resetCall } = useCallStore();

  const endCall = useCallback(() => {
    // On web, we just reset the local state
    resetCall();
  }, [resetCall]);

  return { endCall };
}
