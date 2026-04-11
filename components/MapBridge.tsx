import { Platform } from 'react-native';

// This is the platform-agnostic bridge.
// Expo Metro will automatically pick .native.tsx for iOS/Android
// and .web.tsx for the browser build.

let MapBridge: any;

if (Platform.OS === 'web') {
  MapBridge = require('./MapBridge.web').default;
} else {
  MapBridge = require('./MapBridge.native').default;
}

export default MapBridge;
