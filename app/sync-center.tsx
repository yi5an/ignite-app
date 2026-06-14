import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenBackdrop from '../components/ScreenBackdrop';
import { colors, fonts, radii } from '../constants/theme';
import {
  beginNotionOAuth,
  getNotionOAuthConfig,
  isNotionOAuthEnabled,
  openNotionIntegrationSetup,
} from '../services/notionOAuth';
import { syncKnowledgeEntriesToNotion } from '../services/notionSync';
import { useKnowledgeStore } from '../store/knowledgeStore';
import { useSyncStore } from '../store/syncStore';

function formatDateTime(value?: string) {
  if (!value) return '还没有同步记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SyncCenterScreen() {
  const router = useRouter();
  const { entries, loadEntries, updateEntrySyncStatus } = useKnowledgeStore();
  const {
    isLoaded,
    enabled,
    provider,
    notionDatabaseId,
    notionWorkspaceName,
    notionOAuthClientId,
    notionOAuthExchangeUrl,
    notionToken,
    lastSyncedAt,
    loadSyncSettings,
    updateSyncSettings,
  } = useSyncStore();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [exchangeUrlInput, setExchangeUrlInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadSyncSettings();
    loadEntries();
  }, [loadEntries, loadSyncSettings]);

  useEffect(() => {
    if (!isLoaded) return;
    setClientIdInput(notionOAuthClientId);
    setExchangeUrlInput(notionOAuthExchangeUrl);
  }, [isLoaded, notionOAuthClientId, notionOAuthExchangeUrl]);

  const notionOAuthConfig = getNotionOAuthConfig();
  const oauthEnabled = isNotionOAuthEnabled();
  const queuedEntries = useMemo(
    () => entries.filter((entry) => entry.syncStatus === 'queued'),
    [entries],
  );

  const connectionReady = Boolean(notionToken && notionDatabaseId);
  const statusTone = connectionReady ? colors.green : colors.blue;
  const statusTitle = connectionReady ? 'Notion 已连接' : '连接 Notion';
  const statusBody = connectionReady
    ? notionWorkspaceName
      ? `已接入 ${notionWorkspaceName}，后续计划和记录会写入 Ignite 收集库。`
      : 'Notion 已授权完成，Ignite 收集库也已经准备好。'
    : '授权完成后，App 会自动回到这里并准备好 Ignite 收集库。';
  const browserHint = !connectionReady
    ? '如果这是安卓模拟器第一次打开浏览器，系统可能会先显示一次 Chrome 初始化页；继续后就会进入 Notion 登录。'
    : undefined;

  async function handleConnect() {
    setIsConnecting(true);
    try {
      if (oauthEnabled) {
        await beginNotionOAuth();
      } else {
        await openNotionIntegrationSetup();
        Alert.alert(
          '还差应用配置',
          'Notion 集成后台已经打开。当前设备还没拿到完整 OAuth 配置，所以暂时不能直接完成授权回跳。',
        );
      }
    } catch (error) {
      Alert.alert('无法打开 Notion', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleSaveAdvanced() {
    await updateSyncSettings({
      notionOAuthClientId: clientIdInput.trim(),
      notionOAuthExchangeUrl: exchangeUrlInput.trim(),
      provider: 'notion',
    });
    Alert.alert('已保存', 'OAuth 调试配置已更新。');
  }

  async function handleSyncNow() {
    if (!notionToken) {
      Alert.alert('尚未连接', '请先完成 Notion 授权。');
      return;
    }

    if (!notionDatabaseId) {
      Alert.alert('收集库未准备好', '请先完成授权回跳，让 App 自动创建 Ignite 收集库。');
      return;
    }

    if (queuedEntries.length === 0) {
      Alert.alert('没有待同步内容', '先去记录工作台写一点计划、笔记或总结吧。');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncKnowledgeEntriesToNotion({
        token: notionToken,
        databaseInput: notionDatabaseId,
        entries: queuedEntries,
      });

      for (const item of result.synced) {
        await updateEntrySyncStatus(item.entryId, 'synced');
      }

      await updateSyncSettings({
        enabled: true,
        provider: 'notion',
        lastSyncedAt: new Date().toISOString(),
      });
      await loadEntries();

      if (result.failed.length > 0) {
        Alert.alert(
          '部分同步完成',
          `成功 ${result.synced.length} 条，失败 ${result.failed.length} 条。`,
        );
      } else {
        Alert.alert('同步完成', `已写入 ${result.synced.length} 条记录到 Notion。`);
      }
    } catch (error) {
      Alert.alert('同步失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScreenBackdrop variant="settings" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/')}
          hitSlop={8}
        >
          <Text style={styles.backButtonText}>‹ 回到今天</Text>
        </Pressable>

        <Text style={styles.eyebrow}>笔记同步</Text>
        <Text style={styles.title}>把计划和记录自动沉淀到 Notion</Text>
        <Text style={styles.subtitle}>
          用户侧只需要点一次连接。授权完成后，App 会自动准备 Ignite 收集库。
        </Text>

        <View style={[styles.card, { borderColor: statusTone }]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{statusTitle}</Text>
            <View style={[styles.badge, { backgroundColor: connectionReady ? 'rgba(52,211,153,0.14)' : 'rgba(79,142,247,0.14)' }]}>
              <Text style={[styles.badgeText, { color: statusTone }]}>
                {connectionReady ? '已连接' : '待连接'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardBody}>{statusBody}</Text>

          <Pressable
            style={[styles.primaryButton, isConnecting && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={isConnecting}
          >
            <Text style={styles.primaryButtonText}>
              {isConnecting ? '正在打开 Notion...' : '连接 Notion'}
            </Text>
          </Pressable>

          {browserHint ? <Text style={styles.helperText}>{browserHint}</Text> : null}

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{queuedEntries.length}</Text>
              <Text style={styles.statLabel}>待同步记录</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{connectionReady ? '就绪' : '未就绪'}</Text>
              <Text style={styles.statLabel}>Ignite 收集库</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>同步动作</Text>
          <Text style={styles.cardBody}>
            当前只保留最关键的链路：连接、排队、手动同步。等这条链路稳定后，再继续扩展其它预览与导出能力。
          </Text>

          <Pressable
            style={[styles.primaryButton, (!connectionReady || isSyncing) && styles.buttonDisabled]}
            onPress={handleSyncNow}
            disabled={!connectionReady || isSyncing}
          >
            <Text style={styles.primaryButtonText}>
              {isSyncing ? '正在同步到 Notion...' : '把待同步记录推送到 Notion'}
            </Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => router.push('/knowledge')}>
            <Text style={styles.secondaryButtonText}>前往记录工作台</Text>
          </Pressable>

          <Text style={styles.helperText}>上次同步：{formatDateTime(lastSyncedAt)}</Text>
          <Text style={styles.helperText}>
            当前 Provider：{enabled && provider === 'notion' ? 'Notion' : '未启用'}
          </Text>
        </View>

        <View style={styles.card}>
          <Pressable
            style={styles.rowBetween}
            onPress={() => setShowAdvanced((value) => !value)}
          >
            <Text style={styles.cardTitle}>开发调试配置</Text>
            <Text style={styles.toggleText}>{showAdvanced ? '收起' : '展开'}</Text>
          </Pressable>

          <Text style={styles.cardBody}>
            这部分不是给普通用户填的，只用于本地联调 OAuth。
          </Text>

          {showAdvanced ? (
            <View style={styles.advancedBlock}>
              <Text style={styles.inputLabel}>OAuth Client ID</Text>
              <TextInput
                style={styles.input}
                value={clientIdInput}
                onChangeText={setClientIdInput}
                placeholder="OAuth Client ID"
                placeholderTextColor={colors.text3}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>OAuth Exchange URL</Text>
              <TextInput
                style={styles.input}
                value={exchangeUrlInput}
                onChangeText={setExchangeUrlInput}
                placeholder="http://10.0.2.2:8787/api/notion/oauth/exchange"
                placeholderTextColor={colors.text3}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Pressable style={styles.secondaryButton} onPress={handleSaveAdvanced}>
                <Text style={styles.secondaryButtonText}>保存调试配置</Text>
              </Pressable>

              <Text style={styles.helperText}>当前生效 Client ID：{notionOAuthConfig.clientId || '未配置'}</Text>
              <Text style={styles.helperText}>当前生效 Exchange URL：{notionOAuthConfig.exchangeUrl || '未配置'}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 32,
    gap: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text3,
  },
  eyebrow: {
    fontSize: 11,
    color: colors.text3,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text2,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 18,
    gap: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text2,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: radii.md,
    backgroundColor: colors.bg2,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 4,
  },
  statValue: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text3,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text3,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.blue,
  },
  advancedBlock: {
    gap: 10,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.text2,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg2,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 14,
  },
});
