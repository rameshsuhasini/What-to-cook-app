import { create } from 'zustand'

interface NetworkState {
  isOnline: boolean
  isServerReachable: boolean
  setOnline: (value: boolean) => void
  setServerReachable: (value: boolean) => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isServerReachable: true,
  setOnline: (isOnline) => set({ isOnline }),
  setServerReachable: (isServerReachable) => set({ isServerReachable }),
}))
