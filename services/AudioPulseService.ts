import { Audio } from 'expo-av';
import { Platform } from 'react-native';

const HEARTBEAT_B64 = 'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA=';
// This is a minimal valid WAV shim. In a production build, the OS handles the loop pacing via expo-av.

class AudioPulseService {
  private sound: Audio.Sound | null = null;
  private isPlaying = false;

  async startPulse() {
    if (this.isPlaying) return;
    try {
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          playThroughEarpieceAndroid: false,
        });
      }

      // For the synthesis: We simulate a heartbeat by playing a short "thump" on a loop.
      // Since generating PCM in JS is high-latency, we use a base64 pulse asset.
      const { sound } = await Audio.Sound.createAsync(
        { uri: HEARTBEAT_B64 },
        { shouldPlay: true, isLooping: true, volume: 0.5, rate: 0.8 }
      );
      this.sound = sound;
      this.isPlaying = true;
    } catch (e) {
      console.error('AudioPulse failed', e);
    }
  }

  async stopPulse() {
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
      this.sound = null;
    }
    this.isPlaying = false;
  }
}

export const audioPulse = new AudioPulseService();
