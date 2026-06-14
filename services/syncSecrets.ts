type SecureProvider = 'notion' | 'evernote';

function getStorageKey(provider: SecureProvider): string {
  return `ignite_sync_${provider}_token`;
}

function getCustomStorageKey(key: string): string {
  return `ignite_sync_${key}`;
}

export async function getProviderToken(provider: SecureProvider): Promise<string> {
  try {
    const SecureStore = require('expo-secure-store');
    return (await SecureStore.getItemAsync(getStorageKey(provider))) || '';
  } catch {
    return '';
  }
}

export async function setProviderToken(provider: SecureProvider, token: string): Promise<void> {
  try {
    const SecureStore = require('expo-secure-store');
    if (token) {
      await SecureStore.setItemAsync(getStorageKey(provider), token);
    } else {
      await SecureStore.deleteItemAsync(getStorageKey(provider));
    }
  } catch {
    // Silently ignore; sync center can still work as local-only.
  }
}

export async function getSecureValue(key: string): Promise<string> {
  try {
    const SecureStore = require('expo-secure-store');
    return (await SecureStore.getItemAsync(getCustomStorageKey(key))) || '';
  } catch {
    return '';
  }
}

export async function setSecureValue(key: string, value: string): Promise<void> {
  try {
    const SecureStore = require('expo-secure-store');
    if (value) {
      await SecureStore.setItemAsync(getCustomStorageKey(key), value);
    } else {
      await SecureStore.deleteItemAsync(getCustomStorageKey(key));
    }
  } catch {
    // Silently ignore.
  }
}

export function maskToken(token: string): string {
  if (!token) return '未配置';
  if (token.length <= 8) return '已配置';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}
