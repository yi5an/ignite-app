import * as ExpoLinking from 'expo-linking';
import { Linking } from 'react-native';
import { getSecureValue, setProviderToken, setSecureValue } from './syncSecrets';
import { useSyncStore } from '../store/syncStore';

const OAUTH_AUTHORIZE_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_INTEGRATIONS_URL = 'https://www.notion.so/my-integrations';
const DEFAULT_NOTION_OAUTH_CLIENT_ID = '350d872b-594c-810f-887c-00374be80bb3';
const DEFAULT_NOTION_OAUTH_EXCHANGE_URL = 'http://10.0.2.2:8787/api/notion/oauth/exchange';

export interface NotionOAuthConfig {
  clientId: string;
  redirectUri: string;
  exchangeUrl: string;
}

export interface NotionOAuthExchangeResult {
  access_token: string;
  refresh_token?: string;
  workspace_name?: string;
  workspace_id?: string;
  bot_id?: string;
  duplicated_template_id?: string | null;
}

function randomState(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function getNotionOAuthConfig(): NotionOAuthConfig {
  const state = useSyncStore.getState();
  return {
    clientId:
      state.notionOAuthClientId ||
      process.env.EXPO_PUBLIC_NOTION_OAUTH_CLIENT_ID ||
      DEFAULT_NOTION_OAUTH_CLIENT_ID,
    redirectUri:
      process.env.EXPO_PUBLIC_NOTION_OAUTH_REDIRECT_URI || ExpoLinking.createURL('/oauth/notion'),
    exchangeUrl:
      state.notionOAuthExchangeUrl ||
      process.env.EXPO_PUBLIC_NOTION_OAUTH_EXCHANGE_URL ||
      DEFAULT_NOTION_OAUTH_EXCHANGE_URL,
  };
}

export function isNotionOAuthEnabled(): boolean {
  const config = getNotionOAuthConfig();
  return Boolean(config.clientId && config.redirectUri && config.exchangeUrl);
}

export async function beginNotionOAuth(): Promise<void> {
  const config = getNotionOAuthConfig();
  if (!config.clientId || !config.redirectUri) {
    throw new Error('当前构建未配置 Notion OAuth Client ID 或 Redirect URI。');
  }

  const state = randomState();
  await setSecureValue('notion_oauth_state', state);

  const authUrl =
    `${OAUTH_AUTHORIZE_URL}?owner=user` +
    `&client_id=${encodeURIComponent(config.clientId)}` +
    `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  const supported = await Linking.canOpenURL(authUrl);
  if (!supported) {
    throw new Error('当前设备无法打开 Notion 授权页面。');
  }

  await Linking.openURL(authUrl);
}

export async function openNotionIntegrationSetup(): Promise<void> {
  const supported = await Linking.canOpenURL(NOTION_INTEGRATIONS_URL);
  if (!supported) {
    throw new Error('当前设备无法打开 Notion 集成后台。');
  }

  await Linking.openURL(NOTION_INTEGRATIONS_URL);
}

export async function exchangeNotionOAuthCode(code: string, state?: string): Promise<NotionOAuthExchangeResult> {
  const config = getNotionOAuthConfig();
  if (!config.exchangeUrl) {
    throw new Error('当前构建未配置 Notion OAuth 交换服务地址。');
  }

  const savedState = await getSecureValue('notion_oauth_state');
  if (savedState && state && savedState !== state) {
    throw new Error('Notion 授权状态校验失败，请重新发起连接。');
  }

  const response = await fetch(config.exchangeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    let message = `授权换取 Token 失败 (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      } else if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // Ignore non-JSON errors.
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as NotionOAuthExchangeResult;
  if (!payload.access_token) {
    throw new Error('交换服务未返回 access_token');
  }

  await setProviderToken('notion', payload.access_token);
  if (payload.refresh_token) {
    await setSecureValue('notion_refresh_token', payload.refresh_token);
  }
  await setSecureValue('notion_oauth_state', '');

  await useSyncStore.getState().updateSyncSettings({
    enabled: true,
    provider: 'notion',
  });

  return payload;
}
