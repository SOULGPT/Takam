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

export interface Bond {
  id: string;
  user_a: string;
  user_b: string | null;
  bond_code: string;
  bond_type: BondType;
  status: 'pending' | 'active' | 'dissolved';
  created_at: string;
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
}

interface AppState {
  session: Session | null;
  profile: Profile | null;

  // ── Multi-bond state ──────────────────────────────────────────────────────
  bonds: Bond[];                        // all pending + active bonds
  bondMembers: Record<string, Profile>; // partner Profile, keyed by bond_id
  activeBondId: string | null;          // which bond Home/Gift operates on

  // ── Actions ───────────────────────────────────────────────────────────────
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;

  setBonds: (bonds: Bond[]) => void;
  addBond: (bond: Bond) => void;
  updateBond: (bond: Bond) => void;
  removeBond: (bondId: string) => void;

  setBondMember: (bondId: string, profile: Profile) => void;
  setActiveBondId: (id: string | null) => void;

  reset: () => void;
}

export const useStore = create<AppState>((set) => ({
  session: null,
  profile: null,
  bonds: [],
  bondMembers: {},
  activeBondId: null,

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

  setActiveBondId: (activeBondId) => set({ activeBondId }),

  reset: () =>
    set({ session: null, profile: null, bonds: [], bondMembers: {}, activeBondId: null }),
}));
