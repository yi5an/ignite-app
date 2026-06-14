import { create } from 'zustand';
import { database } from '../services/database';
import { SyncSettings } from '../types';
import { getProviderToken, setProviderToken } from '../services/syncSecrets';

const DEFAULT_NOTION_OAUTH_CLIENT_ID = '350d872b-594c-810f-887c-00374be80bb3';
const DEFAULT_NOTION_OAUTH_EXCHANGE_URL = 'http://10.0.2.2:8787/api/notion/oauth/exchange';

const defaultSyncSettings: SyncSettings = {
  enabled: false,
  provider: 'notion',
  mode: 'daily',
  syncPlans: true,
  syncNotes: true,
  syncPractice: true,
  syncSummaries: true,
  notionDatabaseId: '',
  notionDataSourceId: '',
  notionWorkspaceName: '',
  notionOAuthClientId: DEFAULT_NOTION_OAUTH_CLIENT_ID,
  notionOAuthExchangeUrl: DEFAULT_NOTION_OAUTH_EXCHANGE_URL,
  evernoteNotebook: '',
  exportFolder: '',
  lastSyncedAt: '',
  lastExportPath: '',
};

const SYNC_KEYS: (keyof SyncSettings)[] = [
  'enabled',
  'provider',
  'mode',
  'syncPlans',
  'syncNotes',
  'syncPractice',
  'syncSummaries',
  'notionDatabaseId',
  'notionDataSourceId',
  'notionWorkspaceName',
  'notionOAuthClientId',
  'notionOAuthExchangeUrl',
  'evernoteNotebook',
  'exportFolder',
  'lastSyncedAt',
  'lastExportPath',
];

function parseValue(value: string | null, key: keyof SyncSettings): SyncSettings[keyof SyncSettings] {
  if (value === null || value === undefined) {
    return defaultSyncSettings[key];
  }

  switch (key) {
    case 'enabled':
    case 'syncPlans':
    case 'syncNotes':
    case 'syncPractice':
    case 'syncSummaries':
      return value === 'true' || value === '1';
    default:
      return value;
  }
}

interface SyncState extends SyncSettings {
  isLoaded: boolean;
  notionToken: string;
  evernoteToken: string;
  loadSyncSettings: () => Promise<void>;
  updateSyncSettings: (settings: Partial<SyncSettings>) => Promise<void>;
  updateProviderToken: (provider: 'notion' | 'evernote', token: string) => Promise<void>;
  getEnabledItemCount: () => number;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  ...defaultSyncSettings,
  isLoaded: false,
  notionToken: '',
  evernoteToken: '',

  loadSyncSettings: async () => {
    try {
      const allSettings = await database.getAllSettings();
      const notionToken = await getProviderToken('notion');
      const evernoteToken = await getProviderToken('evernote');
      const loaded: Partial<SyncSettings> = {};

      for (const key of SYNC_KEYS) {
        const raw = allSettings[`sync.${key}`];
        (loaded as Record<string, unknown>)[key] = parseValue(raw, key);
      }

      set({
        ...defaultSyncSettings,
        ...loaded,
        notionToken,
        evernoteToken,
        isLoaded: true,
      });
    } catch (error) {
      console.error('[syncStore] loadSyncSettings failed:', error);
      set({ ...defaultSyncSettings, notionToken: '', evernoteToken: '', isLoaded: true });
    }
  },

  updateSyncSettings: async (settings) => {
    try {
      const current = get();
      const updated = { ...current, ...settings };

      for (const [key, value] of Object.entries(settings)) {
        await database.setSetting(`sync.${key}`, String(value ?? ''));
      }

      set(updated);
    } catch (error) {
      console.error('[syncStore] updateSyncSettings failed:', error);
    }
  },

  updateProviderToken: async (provider, token) => {
    try {
      await setProviderToken(provider, token);
      set(provider === 'notion' ? { notionToken: token } : { evernoteToken: token });
    } catch (error) {
      console.error('[syncStore] updateProviderToken failed:', error);
    }
  },

  getEnabledItemCount: () => {
    const state = get();
    return [state.syncPlans, state.syncNotes, state.syncPractice, state.syncSummaries].filter(Boolean).length;
  },
}));
