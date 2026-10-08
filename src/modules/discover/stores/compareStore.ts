import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CompareCreator = {
  id: string;
  name: string;
  handle?: string;
  avatarUrl?: string | null;
};

/** Most creators the comparison shows side by side. */
export const MAX_COMPARE = 4;

type CompareState = {
  creators: CompareCreator[];
  toggle: (creator: CompareCreator) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useCompareStore = create<CompareState>()(
  persist(
    (set) => ({
      creators: [],
      toggle: (creator) => set((state) => {
        if (state.creators.some((item) => item.id === creator.id)) {
          return { creators: state.creators.filter((item) => item.id !== creator.id) };
        }
        if (state.creators.length >= MAX_COMPARE) return state;
        return { creators: [...state.creators, creator] };
      }),
      remove: (id) => set((state) => ({ creators: state.creators.filter((item) => item.id !== id) })),
      clear: () => set({ creators: [] }),
    }),
    {
      name: 'mutiny-influencer-comparison',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
