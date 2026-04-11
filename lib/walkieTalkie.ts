import { createAudioPlayer, useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

let recordingInstance: any = null;

export const requestMicrophonePermission = async () => {
  const { status } = await AudioModule.requestRecordingPermissionsAsync();
  return status === 'granted';
};

export const startRecording = async () => {
  try {
    if (recordingInstance) {
       try { await recordingInstance.stop(); } catch (e) { console.debug('Recorder already stopped'); }
       recordingInstance = null;
    }

    // New AudioModule config
    await AudioModule.setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });

    recordingInstance = new AudioModule.AudioRecorder(RecordingPresets.LOW_QUALITY);
    await recordingInstance.prepareToRecordAsync();
    recordingInstance.record();
    return true;
  } catch (err) {
    console.error('Failed to start recording', err);
    recordingInstance = null;
    throw err;
  }
};

export const stopRecording = async () => {
  if (!recordingInstance) return null;

  try {
    await recordingInstance.stop();
    const uri = recordingInstance.uri;
    recordingInstance = null;
    return uri;
  } catch (err) {
    console.error('Failed to stop recording', err);
    recordingInstance = null;
    throw err;
  }
};

export const stopRecordingAndUpload = async (bondId: string, userId: string) => {
  const uri = await stopRecording();
  if (!uri) return null;

  try {
    const actualExt = uri.split('.').pop() || 'm4a';
    const fileName = `burst_${bondId}_${Date.now()}.${actualExt}`;
    const filePath = `${bondId}/${fileName}`;

    let blob: Blob;
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      blob = await response.blob();
    } else {
      // Use FileSystem for potentially faster access on Native
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const buffer = decode(base64);
      blob = new Blob([buffer], { type: actualExt === 'webm' ? 'audio/webm' : 'audio/m4a' });
    }

    const { data, error } = await supabase.storage
      .from('walkie-bursts')
      .upload(filePath, blob, {
        contentType: actualExt === 'webm' ? 'audio/webm' : 'audio/m4a',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('walkie-bursts')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('Failed to upload recording', err);
    throw err;
  }
};

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
