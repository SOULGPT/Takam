import { Audio } from 'expo-av';

const HEARTBEAT_B64 = 'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
// Note: This is a tiny silent placeholder. In real production, we'd use a real heartbeat.ogg/mp3.

class AudioPulseService {
  private sound: Audio.Sound | null = null;
  private isPlaying = false;

  async startPulse() {
    if (this.isPlaying) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldRouteThroughEarpieceAndroid: false,
      });

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
