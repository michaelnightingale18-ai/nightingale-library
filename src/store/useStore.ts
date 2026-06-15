"use client";
import { create } from "zustand";
import type { Book, Profile } from "@/lib/types";

interface AppStore {
  currentProfile: Profile | null;
  celebrationBook: Book | null;
  setCurrentProfile: (profile: Profile | null) => void;
  showCelebration: (book: Book) => void;
  hideCelebration: () => void;
}

export const useStore = create<AppStore>((set) => ({
  currentProfile: null,
  celebrationBook: null,
  setCurrentProfile: (profile) => set({ currentProfile: profile }),
  showCelebration: (book) => set({ celebrationBook: book }),
  hideCelebration: () => set({ celebrationBook: null }),
}));
