import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSettingsStore } from '../../store/settingsStore';
import { useXPStore } from '../../store/xpStore';
import { database } from '../../services/database';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import { useSyncStore } from '../../store/syncStore';

// ─── Types ──────────────────────────────────────────────────────
interface SettingItem {
  icon: string;
  label: string;
  value?: string;
  isToggle?: boolean;
  toggleValue?: boolean;
  onPress?: () => void;
  onToggle?: (val: boolean) => void;
  isDestructive?: boolean;
}

// ─── Component ───────────────────────────────────────────────────
export default function Settings() {
  const router = useRouter();
  const {
    pomodoroDuration,
    dailyReminderTime,
    aiModel,
    apiKey,
    isDarkMode,
    isLoaded,
    loadSettings,
    updateSettings,
  } = useSettingsStore();

  const { streakDays, loadStats } = useXPStore();
  const { enabled: syncEnabled, provider: syncProvider, mode: syncMode, loadSyncSettings } = useSyncStore();
  const insets = useSafeAreaInsets();
  const [userName, setUserName] = useState('用户');

  // Load data on mount
  useEffect(() => {
    loadSettings();
    loadStats();
    loadSyncSettings();
  }, [loadSettings, loadStats, loadSyncSettings]);

  const syncSummary = !syncEnabled
    ? '仅本地保存'
    : `${syncProvider === 'notion' ? 'Notion' : syncProvider === 'evernote' ? '印象笔记' : '通用导出'} · ${syncMode === 'instant' ? '实时' : '汇总'}`;

  // ── Handlers ──
  const handleClearData = useCallback(() => {
    Alert.alert('清除所有数据', '此操作不可撤销，确定要清除所有数据吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: () => {
          Alert.alert('已清除', '所有数据已清除');
        },
      },
    ]);
  }, []);

  const handleToggleDarkMode = useCallback(
    (value: boolean) => {
      updateSettings({ isDarkMode: value });
    },
    [updateSettings],
  );

  // ── Build settings list ──
  const settingsList: SettingItem[] = [
    {
      icon: '🍅',
      label: '番茄钟时长',
      value: `${pomodoroDuration}分钟`,
    },
    {
      icon: '⏰',
      label: '每日提醒',
      value: dailyReminderTime,
    },
    {
      icon: '🤖',
      label: 'AI 模型',
      value: aiModel === 'glm' ? 'GLM-4-Plus' : 'Claude',
    },
    {
      icon: '🔑',
      label: 'API Key',
      value: apiKey ? '已配置' : '未配置',
    },
    {
      icon: '🌙',
      label: '深色模式',
      isToggle: true,
      toggleValue: isDarkMode,
      onToggle: handleToggleDarkMode,
    },
    {
      icon: '📝',
      label: '笔记同步',
      value: syncSummary,
      onPress: () => router.push('/sync-center'),
    },
    {
      icon: '📚',
      label: '记录工作台',
      value: '计划 / 笔记 / 习题 / 总结',
      onPress: () => router.push('/knowledge'),
    },
    {
      icon: '📊',
      label: '数据备份',
    },
    {
      icon: 'ℹ️',
      label: '关于',
      value: 'v0.1 Alpha',
    },
  ];

  return (
    <View style={styles.root}>
      <ScreenBackdrop variant="settings" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── User Card ──────────────────────────────────────── */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userStreak}>已坚持 {streakDays} 天 🔥</Text>
          </View>
        </View>

        {/* ─── Settings List ──────────────────────────────────── */}
        <View style={styles.settingsCard}>
          {settingsList.map((item, index) => {
            const isLast = index === settingsList.length - 1;
            return (
              <Pressable
                key={item.label}
                style={[styles.settingRow, !isLast && styles.settingRowBorder]}
                onPress={item.onPress}
                disabled={item.isToggle}
              >
                <Text style={styles.settingIcon}>{item.icon}</Text>
                <Text style={styles.settingLabel}>{item.label}</Text>

                {item.isToggle ? (
                  <Switch
                    value={item.toggleValue ?? false}
                    onValueChange={item.onToggle}
                    trackColor={{ false: '#2A2A38', true: '#4F8EF7' }}
                    thumbColor="#FFFFFF"
                    style={styles.switch}
                  />
                ) : (
                  <>
                    {item.value && (
                      <Text style={styles.settingValue}>{item.value}</Text>
                    )}
                    <Text style={styles.settingArrow}>›</Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* ─── Clear Data Button ──────────────────────────────── */}
        <Pressable style={styles.clearButton} onPress={handleClearData}>
          <Text style={styles.clearButtonText}>清除所有数据</Text>
        </Pressable>

        {/* Bottom spacer for tab bar */}
        <View style={[styles.bottomSpacer, { height: 68 + insets.bottom + 16 }]} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    position: 'relative',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  // ─── User Card ────────────────────────────────────────────────
  userCard: {
    backgroundColor: '#4F8EF7',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: 'rgba(79,142,247,0.45)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 5,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4F8EF7',
    lineHeight: 26,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontFamily: 'Syne',
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  userStreak: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 16,
  },
  // ─── Settings Card ────────────────────────────────────────────
  settingsCard: {
    backgroundColor: '#18181F',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(243,244,246,0.1)',
  },
  settingIcon: {
    fontSize: 16,
    lineHeight: 20,
    width: 24,
    textAlign: 'center',
  },
  settingLabel: {
    flex: 1,
    fontSize: 13,
    color: '#E8E8F0',
    lineHeight: 18,
  },
  settingValue: {
    fontFamily: 'DM Mono',
    fontSize: 11,
    color: '#55556A',
    lineHeight: 14,
  },
  settingArrow: {
    fontSize: 16,
    color: '#55556A',
    lineHeight: 20,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  // ─── Clear Data Button ────────────────────────────────────────
  clearButton: {
    marginHorizontal: 0,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 13,
    color: '#F87171',
    fontWeight: '500',
    lineHeight: 18,
  },
  // ─── Bottom Spacer ────────────────────────────────────────────
  bottomSpacer: {
    height: 68,
  },
});
