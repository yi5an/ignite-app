import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenBackdrop from '../components/ScreenBackdrop';
import { colors, fonts, radii } from '../constants/theme';
import { useKnowledgeStore } from '../store/knowledgeStore';
import { useSyncStore } from '../store/syncStore';
import type { KnowledgeEntryType } from '../types';

const ENTRY_TYPES: {
  key: KnowledgeEntryType;
  label: string;
  subtitle: string;
  emoji: string;
  accent: string;
  bg: string;
  placeholderTitle: string;
  placeholderContent: string;
  template: string;
}[] = [
  {
    key: 'plans',
    label: '计划',
    subtitle: '任务拆解 / 明日安排',
    emoji: '🗂️',
    accent: colors.blue,
    bg: 'rgba(79,142,247,0.12)',
    placeholderTitle: '例如：周五推进计划',
    placeholderContent: '今天准备推进什么？最小一步是什么？卡点会出现在哪？',
    template: '1. 今天要推进的目标\n2. 最小一步\n3. 预计花费时间\n4. 可能阻碍',
  },
  {
    key: 'notes',
    label: '笔记',
    subtitle: '灵感 / 过程记录',
    emoji: '✍️',
    accent: colors.green,
    bg: 'rgba(52,211,153,0.12)',
    placeholderTitle: '例如：AI 工具 newsletter 灵感',
    placeholderContent: '把刚想到的内容先记下来，后面再整理。',
    template: '背景：\n发现：\n可继续展开的方向：',
  },
  {
    key: 'practice',
    label: '习题',
    subtitle: '题目 / 错题 / 复盘',
    emoji: '🧩',
    accent: colors.amber,
    bg: 'rgba(251,191,36,0.12)',
    placeholderTitle: '例如：二分边界题复盘',
    placeholderContent: '题目、错误原因、正确思路、下次提醒，顺手记一条。',
    template: '题目：\n错误点：\n正确思路：\n复盘提醒：',
  },
  {
    key: 'summaries',
    label: '总结',
    subtitle: '阶段回顾 / AI 提炼',
    emoji: '✨',
    accent: colors.purple,
    bg: 'rgba(167,139,250,0.12)',
    placeholderTitle: '例如：本周内容产出总结',
    placeholderContent: '把今天或这一阶段的经验沉淀成几行清晰结论。',
    template: '今天完成了什么：\n有效的方法：\n还需要优化的地方：\n下一步：',
  },
];

function formatEntryTime(value: string): string {
  const date = new Date(value);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function providerLabel(provider: string): string {
  if (provider === 'notion') return 'Notion';
  if (provider === 'evernote') return '印象笔记';
  if (provider === 'markdown') return '通用导出';
  return '仅本地';
}

export default function KnowledgeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeType, setActiveType] = useState<KnowledgeEntryType>('notes');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { entries, isLoading, loadEntries, createEntry } = useKnowledgeStore();
  const {
    enabled,
    provider,
    mode,
    syncPlans,
    syncNotes,
    syncPractice,
    syncSummaries,
    loadSyncSettings,
  } = useSyncStore();

  useEffect(() => {
    loadSyncSettings();
  }, [loadSyncSettings]);

  useEffect(() => {
    loadEntries(activeType);
  }, [activeType, loadEntries]);

  const activeMeta = useMemo(
    () => ENTRY_TYPES.find((item) => item.key === activeType)!,
    [activeType],
  );

  const enabledMap: Record<KnowledgeEntryType, boolean> = {
    plans: syncPlans,
    notes: syncNotes,
    practice: syncPractice,
    summaries: syncSummaries,
  };

  const currentTypeEnabled = enabledMap[activeType];
  const saveLabel = enabled && currentTypeEnabled ? '保存并加入同步队列' : '保存到本地收集箱';

  async function handleSave() {
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();

    if (!normalizedTitle && !normalizedContent) return;

    setIsSaving(true);
    try {
      await createEntry({
        type: activeType,
        title: normalizedTitle || activeMeta.label,
        content: normalizedContent || normalizedTitle,
      });
      setTitle('');
      setContent('');
      await loadEntries(activeType);
    } finally {
      setIsSaving(false);
    }
  }

  function applyTemplate() {
    if (!title.trim()) {
      setTitle(activeMeta.placeholderTitle.replace('例如：', ''));
    }
    setContent(activeMeta.template);
  }

  return (
    <View style={styles.root}>
      <ScreenBackdrop variant="settings" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backText}>‹ 返回同步设置</Text>
          </Pressable>

          <View style={styles.hero}>
            <Text style={styles.heroTitle}>记录工作台</Text>
            <Text style={styles.heroSubtitle}>
              在 App 里直接写计划、笔记、习题和总结，之后再同步到外部知识库。
            </Text>

            <View style={styles.heroMetaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{providerLabel(provider)}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{mode === 'instant' ? '实时写入' : '每日汇总'}</Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{enabled ? '外部同步已开启' : '当前仅本地保存'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>记录类型</Text>
              <Pressable onPress={() => router.push('/sync-center')}>
                <Text style={styles.sectionLink}>调整同步范围</Text>
              </Pressable>
            </View>

            <View style={styles.typeGrid}>
              {ENTRY_TYPES.map((item) => {
                const active = item.key === activeType;
                return (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.typeCard,
                      active && styles.typeCardActive,
                      active && { borderColor: item.accent, backgroundColor: item.bg },
                    ]}
                    onPress={() => setActiveType(item.key)}
                  >
                    <Text style={styles.typeEmoji}>{item.emoji}</Text>
                    <Text style={styles.typeTitle}>{item.label}</Text>
                    <Text style={styles.typeSubtitle}>{item.subtitle}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>快速记录</Text>
              <Pressable style={styles.templateChip} onPress={applyTemplate}>
                <Text style={[styles.templateChipText, { color: activeMeta.accent }]}>套用模版</Text>
              </Pressable>
            </View>

            <View style={styles.editorCard}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={activeMeta.placeholderTitle}
                placeholderTextColor={colors.text3}
                style={styles.titleInput}
              />
              <View style={styles.divider} />
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder={activeMeta.placeholderContent}
                placeholderTextColor={colors.text3}
                style={styles.contentInput}
                multiline
                textAlignVertical="top"
              />

              {!currentTypeEnabled && enabled && (
                <View style={styles.infoBanner}>
                  <Text style={styles.infoBannerText}>
                    当前类型还没加入外部同步范围，保存后会先留在 App 内。
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryPressed,
                  isSaving && styles.primaryDisabled,
                ]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={styles.primaryButtonText}>{isSaving ? '保存中...' : saveLabel}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}
                onPress={() => {
                  setTitle('');
                  setContent('');
                }}
              >
                <Text style={styles.secondaryButtonText}>清空输入</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>最近记录</Text>
              <Text style={styles.sectionHint}>{isLoading ? '载入中...' : `${entries.length} 条`}</Text>
            </View>

            {entries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>这里会显示你最近的记录</Text>
                <Text style={styles.emptySubtitle}>先写下一条，后面就能继续在外部知识库里整理。</Text>
              </View>
            ) : (
              entries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryTopRow}>
                    <Text style={styles.entryTitle} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <View
                      style={[
                        styles.entryBadge,
                        entry.syncStatus === 'queued'
                          ? styles.entryBadgeQueued
                          : entry.syncStatus === 'synced'
                            ? styles.entryBadgeSynced
                            : styles.entryBadgeLocal,
                      ]}
                    >
                      <Text style={styles.entryBadgeText}>
                        {entry.syncStatus === 'queued'
                          ? '待同步'
                          : entry.syncStatus === 'synced'
                            ? '已同步'
                            : '仅本地'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.entryContent} numberOfLines={3}>
                    {entry.content}
                  </Text>
                  <Text style={styles.entryMeta}>{formatEntryTime(entry.createdAt)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  backText: {
    fontSize: 12,
    color: colors.text3,
    lineHeight: 18,
  },
  hero: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
  },
  heroTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  heroSubtitle: {
    fontSize: 12,
    color: colors.text2,
    lineHeight: 18,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.blue,
    backgroundColor: 'rgba(79,142,247,0.14)',
  },
  metaChipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.blue,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sectionHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
  sectionLink: {
    fontSize: 11,
    color: colors.blue,
  },
  typeGrid: {
    gap: 8,
  },
  typeCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    gap: 4,
  },
  typeCardActive: {
    backgroundColor: colors.card2,
  },
  typeEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  typeTitle: {
    fontFamily: fonts.heading,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  typeSubtitle: {
    fontSize: 11,
    color: colors.text2,
    lineHeight: 16,
  },
  templateChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.card2,
  },
  templateChipText: {
    fontFamily: fonts.mono,
    fontSize: 10,
  },
  editorCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    gap: 10,
  },
  titleInput: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    minHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  contentInput: {
    minHeight: 140,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 20,
  },
  infoBanner: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border2,
    backgroundColor: colors.card2,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoBannerText: {
    fontSize: 11,
    color: colors.text2,
    lineHeight: 17,
  },
  actionRow: {
    gap: 8,
  },
  primaryButton: {
    backgroundColor: colors.blue,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  primaryPressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  secondaryPressed: {
    backgroundColor: colors.card2,
  },
  secondaryButtonText: {
    fontSize: 12,
    color: colors.text3,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    gap: 4,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 11,
    color: colors.text2,
    lineHeight: 17,
  },
  entryCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    gap: 6,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryTitle: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  entryBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  entryBadgeLocal: {
    borderColor: colors.border2,
    backgroundColor: colors.card2,
  },
  entryBadgeQueued: {
    borderColor: colors.blue,
    backgroundColor: 'rgba(79,142,247,0.14)',
  },
  entryBadgeSynced: {
    borderColor: colors.green,
    backgroundColor: 'rgba(52,211,153,0.14)',
  },
  entryBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text2,
  },
  entryContent: {
    fontSize: 12,
    color: colors.text2,
    lineHeight: 18,
  },
  entryMeta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.text3,
  },
});
