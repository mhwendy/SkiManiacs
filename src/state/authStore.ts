import { create } from 'zustand';
import type { User } from '@/domain/types';

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (session: {
    user: User;
    accessToken: string;
    refreshToken: string;
  }) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  setUser: (user: User) => void;
  clearUser: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  setSession: (session) => set(session),
  setTokens: (tokens) => set(tokens),
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, accessToken: null, refreshToken: null }),
}));
