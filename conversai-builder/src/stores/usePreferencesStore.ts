import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FontSize = 'sm' | 'md' | 'lg'
export type Theme = 'dark' | 'light'

interface PreferencesState {
  fontSize: FontSize
  theme: Theme
  setFontSize: (size: FontSize) => void
  setTheme: (theme: Theme) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      fontSize: 'md',
      theme: 'dark',
      setFontSize: (fontSize) => set({ fontSize }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'easy-agents-preferences' }
  )
)
