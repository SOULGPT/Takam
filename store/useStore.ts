import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';

export type Sex = 'male' | 'female' | 'prefer_not_to_say';

export type BondType =
  | 'partner'
  | 'spouse'
  | 'bestfriend'
  | 'friend'
  | 'sibling'
  | 'parent'
  | 'child'
  | 'family'
  | 'colleague'
  | 'other';

// ── Shared bond-type metadata (emoji, label, accent color) ────────────────────
export const BOND_META: Record<BondType, { emoji: string; label: string; color: string }> = {
  partner:    { emoji: '💑', label: 'Partner',     color: '#C9705A' },
  spouse:     { emoji: '💍', label: 'Spouse',      color: '#9B6B9A' },
  bestfriend: { emoji: '🌟', label: 'Best Friend', color: '#D4A022' },
  friend:     { emoji: '🤝', label: 'Friend',      color: '#5C8A6A' },
  sibling:    { emoji: '👫', label: 'Sibling',     color: '#5A7EC9' },
  parent:     { emoji: '🧡', label: 'Parent',      color: '#C97050' },
  child:      { emoji: '🌱', label: 'Child',       color: '#6AAB6A' },
  family:     { emoji: '🏡', label: 'Family',      color: '#8A6AC9' },
  colleague:  { emoji: '💼', label: 'Colleague',   color: '#6A8AC9' },
  other:      { emoji: '✨', label: 'Other',       color: '#B5947A' },
};

export type ChatThemeOption = 'classic' | 'midnight' | 'cherry' | 'forest' | 'ocean';

export interface ThemeConfig {
  id: ChatThemeOption;
  name: string;
  bgColors: [string, string, string]; // Top to Bottom LinearGradient
  textColor: string;
  myBubbleColor: string;
  themBubbleColor: string;
  myBubbleText: string;
  themBubbleText: string;
  borderColor: string;
  inputBgColor: string;
  inputTextColor: string;
  headerBgColor: string;
}

export const CHAT_THEMES: Record<ChatThemeOption, ThemeConfig> = {
  classic: {
    id: 'classic',
    name: 'Classic Creme',
    bgColors: ['#F8F9FF', '#F0F2F9', '#E8EAF6'], // Slightly more lavender-tinted background
    textColor: '#1A1A1A',
    myBubbleColor: '#9B3D2C', // Deep Redish Brown from Ref
    themBubbleColor: '#FFFFFF', // Clean White for partner
    myBubbleText: '#FFFFFF',
    themBubbleText: '#1A1A1A',
    borderColor: '#E0E0E0',
    inputBgColor: '#FFFFFF',
    inputTextColor: '#1A1A1A',
    headerBgColor: '#F8F9FF',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    bgColors: ['#121212', '#1A1A1A', '#0F0F0F'],
    textColor: '#E0E0E0',
    myBubbleColor: '#3A3A4A',
    themBubbleColor: '#242424',
    myBubbleText: '#FFFFFF',
    themBubbleText: '#E0E0E0',
    borderColor: '#333333',
    inputBgColor: '#1A1A1A',
    inputTextColor: '#FFFFFF',
    headerBgColor: '#181818',
  },
  cherry: {
    id: 'cherry',
    name: 'Cherry',
    bgColors: ['#FFF0F5', '#FFE4E1', '#FFC0CB'],
    textColor: '#4A1D2C',
    myBubbleColor: '#E75480',
    themBubbleColor: '#FFFFFF',
    myBubbleText: '#FFFFFF',
    themBubbleText: '#4A1D2C',
    borderColor: '#FFB6C1',
    inputBgColor: '#FFF0F5',
    inputTextColor: '#4A1D2C',
    headerBgColor: '#FFF0F5',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    bgColors: ['#E6F0E6', '#CDE0D1', '#A6C5AD'],
    textColor: '#1B3D2B',
    myBubbleColor: '#3D6B50',
    themBubbleColor: '#F3F8F4',
    myBubbleText: '#FFFFFF',
    themBubbleText: '#1B3D2B',
    borderColor: '#A6C5AD',
    inputBgColor: '#E6F0E6',
    inputTextColor: '#1B3D2B',
    headerBgColor: '#E6F0E6',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    bgColors: ['#F0F8FF', '#E1F0F5', '#B0E0E6'],
    textColor: '#1A3C56',
    myBubbleColor: '#4A90E2',
    themBubbleColor: '#FFFFFF',
    myBubbleText: '#FFFFFF',
    themBubbleText: '#1A3C56',
    borderColor: '#B0DFE5',
    inputBgColor: '#F0F8FF',
    inputTextColor: '#1A3C56',
    headerBgColor: '#FFFFFF',
  }
};

export interface Bond {
  id: string;
  user_a: string;
  user_b: string | null;
  bond_code: string;
  bond_type: BondType;
  status: 'pending' | 'requested' | 'active' | 'dissolved';
  created_at: string;
  theme?: ChatThemeOption | string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  sex: Sex | null;
  country: string | null;
  avatar_url: string | null;
  subscription_tier: 'free' | 'ritual';
  role?: string;
  email?: string;
  phone?: string;
  address?: string;
  is_premium?: boolean;
  premium_expires_at?: string;
  is_online?: boolean;
  last_active_at?: string;
  last_latitude?: number;
  last_longitude?: number;
  timezone?: string;
}

interface AppState {
  session: Session | null;
  profile: Profile | null;

  // ── Multi-bond state ──────────────────────────────────────────────────────
  bonds: Bond[];                        // all pending + active bonds
  bondMembers: Record<string, Profile>; // partner Profile, keyed by bond_id
  activeBondId: string | null;          // which bond Home/Gift operates on

  // ── Unread State ────────────────────────────────────────────────────────
  unreadCounts: Record<string, number>; // bond_id -> unread_count
  userBondThemes: Record<string, string>; // bond_id -> theme_key

  // ── Actions ───────────────────────────────────────────────────────────────
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;

  setBonds: (bonds: Bond[]) => void;
  addBond: (bond: Bond) => void;
  updateBond: (bond: Bond) => void;
  removeBond: (bondId: string) => void;

  setBondMember: (bondId: string, profile: Profile) => void;
  setActiveBondId: (id: string | null) => void;

  setUnreadCounts: (counts: Record<string, number>) => void;
  incrementUnread: (bondId: string, amount?: number) => void;
  clearUnread: (bondId: string) => void;
  setUserBondTheme: (bondId: string, theme: string) => void;

  reset: () => void;
}

export const useStore = create<AppState>((set) => ({
  session: null,
  profile: null,
  bonds: [],
  bondMembers: {},
  activeBondId: null,
  unreadCounts: {},
  userBondThemes: {},

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),

  setBonds: (bonds) => set({ bonds }),

  addBond: (bond) =>
    set((state) => ({ bonds: [bond, ...state.bonds] })),

  updateBond: (bond) =>
    set((state) => ({
      bonds: state.bonds.map((b) => (b.id === bond.id ? bond : b)),
    })),

  removeBond: (bondId) =>
    set((state) => {
      const remaining = state.bonds.filter((b) => b.id !== bondId);
      const newBondMembers = { ...state.bondMembers };
      delete newBondMembers[bondId];
      // If we removed the active bond, pick the next active one (or null)
      const newActive =
        state.activeBondId === bondId
          ? (remaining.find((b) => b.status === 'active')?.id ?? null)
          : state.activeBondId;
      return { bonds: remaining, bondMembers: newBondMembers, activeBondId: newActive };
    }),

  setBondMember: (bondId, profile) =>
    set((state) => ({
      bondMembers: { ...state.bondMembers, [bondId]: profile },
    })),

  setActiveBondId: (id) => set({ activeBondId: id }),

  setUnreadCounts: (counts) => set({ unreadCounts: counts }),

  incrementUnread: (bondId, amount = 1) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [bondId]: (state.unreadCounts[bondId] || 0) + amount,
      },
    })),

  clearUnread: (bondId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [bondId]: 0,
      },
    })),

  setUserBondTheme: (bondId, theme) =>
    set((state) => ({
      userBondThemes: {
        ...state.userBondThemes,
        [bondId]: theme,
      },
    })),

  reset: () => set({ session: null, profile: null, bonds: [], bondMembers: {}, activeBondId: null, unreadCounts: {}, userBondThemes: {} }),
}));
