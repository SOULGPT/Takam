import { create } from 'zustand';
import { MediaStream } from 'react-native-webrtc';
import { Profile } from './useStore';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface CallState {
  status: CallStatus;
  isInitiator: boolean;
  activeBondId: string | null;
  caller: Profile | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  
  // Actions
  setCallStatus: (status: CallStatus) => void;
  initiateCall: (bondId: string) => void;
  receiveCall: (bondId: string, caller: Profile) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  resetCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  status: 'idle',
  isInitiator: false,
  activeBondId: null,
  caller: null,
  localStream: null,
  remoteStream: null,

  setCallStatus: (status) => set({ status }),
  
  initiateCall: (bondId) => set({ 
    status: 'calling', 
    isInitiator: true, 
    activeBondId: bondId 
  }),
  
  receiveCall: (bondId, caller) => set({ 
    status: 'ringing', 
    isInitiator: false, 
    activeBondId: bondId,
    caller 
  }),

  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),

  resetCall: () => set({ 
    status: 'idle', 
    isInitiator: false, 
    activeBondId: null, 
    caller: null, 
    localStream: null, 
    remoteStream: null 
  }),
}));
