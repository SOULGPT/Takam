import { Audio } from 'expo-av';

export const SOUND_URLS: Record<string, string> = {
  send: 'https://actions.google.com/sounds/v1/foley/swoosh.ogg',
  receive: 'https://actions.google.com/sounds/v1/water/water_drop.ogg',
  miss_you: 'https://actions.google.com/sounds/v1/bell/bell_ring.ogg',
  love: 'https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg', // quirky heartbeat substitute
  thinking_of_you: 'https://actions.google.com/sounds/v1/cartoon/magic_chime_bell.ogg',
};

// Helper to quickly fire off a sound safely
export async function playSound(type: keyof typeof SOUND_URLS) {
  try {
    const url = SOUND_URLS[type] ?? SOUND_URLS.miss_you;
    const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
    
    // Auto-unload after playback to free memory
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.log('Error playing sound:', error);
  }
}
