import { create } from "zustand";
import type { Song } from "../../lib/supabase";

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  queue: Song[];
  showVideo: boolean;
  play: (song: Song) => void;
  pause: () => void;
  resume: () => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setShowVideo: (show: boolean) => void;
  next: () => void;
  prev: () => void;
  addToQueue: (song: Song) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 0.8,
  queue: [],
  showVideo: false,

  play: (song) => set({ currentSong: song, isPlaying: true, progress: 0, showVideo: false }),
  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setShowVideo: (showVideo) => set({ showVideo }),

  next: () => {
    const { queue, currentSong } = get();
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    const next = queue[idx + 1];
    if (next) set({ currentSong: next, isPlaying: true, progress: 0 });
  },

  prev: () => {
    const { queue, currentSong } = get();
    if (!currentSong || queue.length === 0) return;
    const idx = queue.findIndex(s => s.id === currentSong.id);
    const prev = queue[idx - 1];
    if (prev) set({ currentSong: prev, isPlaying: true, progress: 0 });
  },

  addToQueue: (song) => set(state => ({
    queue: [...state.queue, song]
  }))
}));
