// Settings store using zustand
import { create } from 'zustand';
import { AppSettings } from '../types';
import { database } from '../services/database';

const defaultSettings: AppSettings = {
  pomodoroDuration: 25,
  breakDuration: 5,
  aiModel: 'glm',
  apiKey: '',
  dailyReminderTime: '09:00',
  isDarkMode: true,
};

// Settings keys stored in SQLite (everything except apiKey)
const SETTINGS_KEYS: (keyof AppSettings)[] = [
  'pomodoroDuration',
  'breakDuration',
  'aiModel',
  'dailyReminderTime',
  'isDarkMode',
];

interface SettingsState extends AppSettings {
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

// Secure store helper for API key
async function getSecureApiKey(): Promise<string> {
  try {
    // Use expo-secure-store for apiKey
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync('ignite_api_key') || '';
  } catch {
    // Fallback: read from SQLite settings table
    try {
      const value = await database.getSetting('apiKey');
      return value || '';
    } catch {
      return '';
    }
  }
}

async function setSecureApiKey(apiKey: string): Promise<void> {
  try {
    const SecureStore = require('expo-secure-store');
    if (apiKey) {
      await SecureStore.setItemAsync('ignite_api_key', apiKey);
    } else {
      await SecureStore.deleteItemAsync('ignite_api_key');
    }
  } catch {
    // Fallback: store in SQLite (less secure)
    try {
      await database.setSetting('apiKey', apiKey);
    } catch {
      // Silently fail
    }
  }
}

function parseSettingValue<T>(value: string | null, key: keyof AppSettings): T {
  if (value === null || value === undefined) {
    return defaultSettings[key] as T;
  }

  switch (key) {
    case 'pomodoroDuration':
    case 'breakDuration':
      return parseInt(value, 10) as T || defaultSettings[key] as T;
    case 'isDarkMode':
      return (value === 'true' || value === '1') as T;
    default:
      return value as T;
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const allSettings = await database.getAllSettings();
      const apiKey = await getSecureApiKey();

      const loaded: Partial<AppSettings> = {};

      for (const key of SETTINGS_KEYS) {
        const rawValue = allSettings[key];
        (loaded as any)[key] = parseSettingValue(rawValue, key);
      }

      loaded.apiKey = apiKey;

      set({
        ...defaultSettings,
        ...loaded,
        isLoaded: true,
      });
    } catch (error) {
      console.error('[settingsStore] loadSettings failed:', error);
      // Use defaults on error
      set({ ...defaultSettings, isLoaded: true });
    }
  },

  updateSettings: async (settings) => {
    try {
      const current = get();
      const updated = { ...current, ...settings };

      // Persist each setting to database
      for (const key of SETTINGS_KEYS) {
        if (settings[key] !== undefined) {
          const value = String(settings[key]);
          await database.setSetting(key, value);
        }
      }

      // Persist apiKey securely
      if (settings.apiKey !== undefined) {
        await setSecureApiKey(settings.apiKey);
      }

      set(updated);
    } catch (error) {
      console.error('[settingsStore] updateSettings failed:', error);
    }
  },
}));
