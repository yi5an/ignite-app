import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import { colors, fonts, radii } from '../../constants/theme';
import { exchangeNotionOAuthCode } from '../../services/notionOAuth';
import { ensureIgniteWorkspaceDatabase } from '../../services/notionSync';
import { useSyncStore } from '../../store/syncStore';

export default function NotionOAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    state?: string;
  }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('正在完成 Notion 连接...');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (params.error) {
        setStatus('error');
        setMessage(`Notion 授权被取消或失败：${params.error}`);
        return;
      }

      if (!params.code || typeof params.code !== 'string') {
        setStatus('error');
        setMessage('没有收到 Notion 授权码，请重新发起连接。');
        return;
      }

      try {
        const result = await exchangeNotionOAuthCode(
          params.code,
          typeof params.state === 'string' ? params.state : undefined,
        );
        const setup = await ensureIgniteWorkspaceDatabase({
          token: result.access_token,
          databaseId: useSyncStore.getState().notionDatabaseId || undefined,
        });
        await useSyncStore.getState().updateSyncSettings({
          notionDatabaseId: setup.id,
          notionDataSourceId: setup.dataSourceId,
          notionWorkspaceName: result.workspace_name || '',
          enabled: true,
          provider: 'notion',
        });

        if (cancelled) return;

        setStatus('success');
        setMessage(
          result.workspace_name
            ? `已连接到 ${result.workspace_name}，并已准备好 Ignite 收集库`
            : 'Notion 已连接成功，并已准备好 Ignite 收集库',
        );

        setTimeout(() => {
          router.replace('/sync-center');
        }, 1200);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Notion 连接失败');
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [params.code, params.error, params.state, router]);

  return (
    <View style={styles.root}>
      <ScreenBackdrop variant="settings" />

      <View style={styles.card}>
        <Text style={styles.title}>
          {status === 'loading' ? '连接中' : status === 'success' ? '连接成功' : '连接失败'}
        </Text>
        <Text style={styles.message}>{message}</Text>

        {status !== 'loading' ? (
          <Pressable style={styles.button} onPress={() => router.replace('/sync-center')}>
            <Text style={styles.buttonText}>返回同步中心</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 20,
    gap: 10,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 12,
    color: colors.text2,
    lineHeight: 18,
  },
  button: {
    marginTop: 8,
    borderRadius: radii.md,
    backgroundColor: colors.blue,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
