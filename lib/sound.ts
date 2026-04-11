import { createAudioPlayer } from 'expo-audio';

export const SOUND_URLS: Record<string, string> = {
  send: 'https://actions.google.com/sounds/v1/foley/swoosh.ogg',
  receive: 'https://actions.google.com/sounds/v1/water/water_drop.ogg',
  miss_you: 'https://actions.google.com/sounds/v1/bell/bell_ring.ogg',
  love: 'https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg', // quirky heartbeat substitute
  thinking_of_you: 'https://actions.google.com/sounds/v1/cartoon/magic_chime_bell.ogg',
};

// Player cache to avoid reloading sounds and reduce latency
const playerCache: Record<string, any> = {};

function getPlayer(url: string) {
  if (!playerCache[url]) {
    playerCache[url] = createAudioPlayer(url);
  }
  return playerCache[url];
}

/**
 * Helper to quickly fire off a sound safely using expo-audio.
 * Now optimized with a player cache.
 */
export async function playSound(type: keyof typeof SOUND_URLS) {
  try {
    const url = SOUND_URLS[type] ?? SOUND_URLS.miss_you;
    const player = getPlayer(url);
    
    // In expo-audio, we seek to 0 to replay one-shot sounds
    player.seekTo(0);
    player.play();
  } catch (error) {
    console.warn('Error playing sound:', error);
  }
}

/**
 * Optional: Stop a specific sound if needed
 */
export function stopSound(type: keyof typeof SOUND_URLS) {
  const url = SOUND_URLS[type];
  if (url && playerCache[url]) {
    playerCache[url].pause();
  }
}
