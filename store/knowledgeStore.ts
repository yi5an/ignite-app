import { create } from 'zustand';
import { database } from '../services/database';
import { useSyncStore } from './syncStore';
import { KnowledgeEntry, KnowledgeEntryType, KnowledgeSyncStatus } from '../types';

interface CreateKnowledgeEntryInput {
  type: KnowledgeEntryType;
  title: string;
  content: string;
  relatedTaskId?: string;
}

interface KnowledgeState {
  entries: KnowledgeEntry[];
  isLoading: boolean;
  loadEntries: (type?: KnowledgeEntryType) => Promise<void>;
  createEntry: (input: CreateKnowledgeEntryInput) => Promise<KnowledgeEntry>;
  updateEntrySyncStatus: (entryIds: string[], syncStatus: KnowledgeSyncStatus) => Promise<void>;
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  entries: [],
  isLoading: false,

  loadEntries: async (type) => {
    try {
      set({ isLoading: true });
      const entries = await database.getKnowledgeEntries(type);
      set({ entries, isLoading: false });
    } catch (error) {
      console.error('[knowledgeStore] loadEntries failed:', error);
      set({ isLoading: false });
    }
  },

  createEntry: async (input) => {
    try {
      const { enabled, syncPlans, syncNotes, syncPractice, syncSummaries } = useSyncStore.getState();
      const typeEnabled =
        input.type === 'plans'
          ? syncPlans
          : input.type === 'notes'
            ? syncNotes
            : input.type === 'practice'
              ? syncPractice
              : syncSummaries;

      const entry = await database.createKnowledgeEntry({
        type: input.type,
        title: input.title,
        content: input.content,
        relatedTaskId: input.relatedTaskId,
        syncStatus: enabled && typeEnabled ? 'queued' : 'local',
      });

      set((state) => ({
        entries: [entry, ...state.entries],
      }));

      return entry;
    } catch (error) {
      console.error('[knowledgeStore] createEntry failed:', error);
      throw error;
    }
  },

  updateEntrySyncStatus: async (entryIds, syncStatus) => {
    try {
      for (const entryId of entryIds) {
        await database.updateKnowledgeEntrySyncStatus(entryId, syncStatus);
      }

      set((state) => ({
        entries: state.entries.map((entry) =>
          entryIds.includes(entry.id)
            ? {
                ...entry,
                syncStatus,
                updatedAt: new Date().toISOString(),
              }
            : entry,
        ),
      }));
    } catch (error) {
      console.error('[knowledgeStore] updateEntrySyncStatus failed:', error);
      throw error;
    }
  },
}));
