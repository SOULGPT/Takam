import { createAudioPlayer, useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';

let recordingInstance: any = null;

// The imperative AudioRecorder constructor is not supported on web in SDK 54.
// Recording logic has been moved to the useAudioRecorder hook in ChatScreen.tsx.

// Recording and uploading logic has been moved to ChatScreen.tsx to utilize useAudioRecorder.

export const playBurst = async (url: string, onFinish?: () => void) => {
  try {
    await AudioModule.setAudioModeAsync({
      allowsRecording: false, // Don't block background audio when just playing if possibly
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });

    const player = createAudioPlayer(url);
    
    // In SDK 54, we must manually .remove() players created via createAudioPlayer
    const subscription = player.addListener('playbackStatusUpdate', (status: any) => {
      if (status.didJustFinish) {
        onFinish?.();
        player.remove();
        subscription.remove();
      }
    });

    player.play();
    return player;
  } catch (err) {
    console.error('Failed to play burst', err);
    throw err;
  }
};

// Helper: Check if hardware is busy
export const isRecordingActive = () => !!recordingInstance;

// Helper to decode base64 to ArrayBuffer for Supabase Storage
export function decode(base64: string) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = base64.length * 0.75,
    len = base64.length, i, p = 0,
    encoded1, encoded2, encoded3, encoded4;

  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arrayBuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arrayBuffer);

  for (i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return arrayBuffer;
}
