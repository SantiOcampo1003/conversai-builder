import { create } from 'zustand'

interface EditorState {
  hasUnsavedChanges: boolean
  markAsUnsaved: () => void
  markAsSaved: () => void
  reset: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  hasUnsavedChanges: false,
  markAsUnsaved: () => set({ hasUnsavedChanges: true }),
  markAsSaved: () => set({ hasUnsavedChanges: false }),
  reset: () => set({ hasUnsavedChanges: false }),
}))
