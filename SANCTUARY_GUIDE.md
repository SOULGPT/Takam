# 🏘️ TAKAM Sanctuary: Key Placement Guide

To resolve the remaining "Red Screen" crashes on your physical iPhone, you must replace the following placeholders with your actual developer keys.

### 01. Google Sign-In (Fixes the "ClientID" error)
**File**: `lib/auth/google.ts`
**Action**: Find the `CLIENT_ID` inside your `GoogleService-Info.plist` and paste it here:
```typescript
iosClientId: 'PASTE_YOUR_ID_HERE',
```

### 02. Google Maps (Fixes the "AirGoogleMaps" error)
**File**: `app.json`
**Action**: Replace the placeholder under the `ios` configuration:
```json
"googleMapsApiKey": "PASTE_YOUR_GOOGLE_MAPS_KEY_HERE"
```

### 03. Final Manifestation Command
Once you have pasted the keys, run this to build the final app:
```powershell
npx eas build --platform ios --profile development
```

The Sanctuary is ready. 🏘️🚀✨❤️
