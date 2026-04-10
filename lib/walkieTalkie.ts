import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';

let recordingInstance: Audio.Recording | null = null;

export const requestMicrophonePermission = async () => {
  const { status } = await Audio.requestPermissionsAsync();
  return status === 'granted';
};

export const startRecording = async () => {
  try {
    // 1. Safety Cleanup: Ensure any previous object is completely destroyed
    if (recordingInstance) {
      try {
        await recordingInstance.stopAndUnloadAsync().catch(() => {});
      } catch (e) {
        // Already unloaded or other non-critical error
      }
      recordingInstance = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });

    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.LOW_QUALITY
    );
    recordingInstance = newRecording;
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
    await recordingInstance.stopAndUnloadAsync();
    const uri = recordingInstance.getURI();
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
    // Slight delay to ensure filesystem is ready
    await new Promise(r => setTimeout(r, 100));

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const fileName = `burst_${bondId}_${Date.now()}.m4a`;
    const filePath = `${bondId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('walkie-bursts')
      .upload(filePath, decode(base64), {
        contentType: 'audio/m4a',
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
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, volume: 1.0 }
    );

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        if (onFinish) onFinish();
      }
    });

    return sound;
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
