# TAKAM — A Sacred Space for Bonds

![TAKAM Banner](https://img.shields.io/badge/Status-Stable-success?style=for-the-badge&logo=react&color=C9705A)
![Expo SDK](https://img.shields.io/badge/Expo-SDK_54-000000?style=for-the-badge&logo=expo)
![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge&logo=supabase)

**TAKAM** is a minimalist, private bonding platform designed specifically for couples. It focuses on the subtle, high-quality interactions that define a deep connection, stripping away the noise of traditional social media to create a digital sanctuary for your relationship.

---

## ✨ Core Features

### 📶 Walkie-Talkie Bursts
Short, instant audio snippets for the moments that deserve more than text but less than a call. Powered by a high-fidelity Audio SDK with low-latency delivery.

### 🕯️ Aura Vibes
A real-time atmospheric communication system. Send subtle glows, pulses, or sparkles to your partner’s screen, letting them know they are in your thoughts without saying a word.

### 📍 Meeting Marks & Sacred Map
A private, shared geography. Automatically track and manually mark the locations that matter to your story — from your favorite coffee shop to the place where you first met.

### 🎁 Mystery Rituals
Curated gifting flows and shared experiences. Surprise your partner with digital or physical tokens of affection through integrated checkout flows.

### 🔒 Private by Design
Built on a foundation of **Supabase Row-Level Security (RLS)**. Your conversations, locations, and data are strictly accessible only to your confirmed bond partner.

---

## 🛠️ Technical Architecture

- **Frontend**: [React Native](https://reactnative.dev/) (Expo SDK 54) with full Cross-Platform support (iOS, Android, Web).
- **Backend-as-a-Service**: [Supabase](https://supabase.com/) for Auth, Database, Storage, and Real-time subscriptions.
- **UI/Graphics**: 
  - [React Native Skia](https://shopify.github.io/react-native-skia/) for hardware-accelerated glows and auras.
  - Custom [shadow utility](file:///c:/Users/User/.gemini/antigravity/scratch/takam/lib/theme/shadows.ts) for consistent, platform-agnostic depth.
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) for a lightweight, performant reactive store.
- **Real-time**: Leverages Supabase Postgres Changes and Broadcast channels for sub-500ms latency.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Expo Go (on mobile) or a Browser

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npx expo start
   ```

---

## 🏗️ Folder Structure
- `screens/` - Main application views (Home, Chat, Map, etc.).
- `components/` - Atomic and composite UI elements.
- `lib/` - Core utilities (Theme, Supabase client, Audio wrappers).
- `store/` - Global state management patterns.
- `supabase/` - Database migrations and Edge Functions.

---

*TAKAM — Protect your bond. 💞*
