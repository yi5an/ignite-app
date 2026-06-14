import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTaskStore } from '../../store/taskStore';
import TaskCard from '../../components/TaskCard';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import type { Task, TaskCategory } from '../../types';

// ─── Filter Config ──────────────────────────────────────────────
type FilterOption = 'all' | TaskCategory;

const FILTER_OPTIONS: { key: FilterOption; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'work', label: '工作' },
  { key: 'study', label: '学习' },
  { key: 'creative', label: '创意' },
];

// ─── Component ───────────────────────────────────────────────────
export default function AllTasks() {
  const router = useRouter();
  const { tasks, loadAllTasks, deleteTask, updateTaskStatus } = useTaskStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');

  // Load data on mount
  useEffect(() => {
    loadAllTasks();
  }, [loadAllTasks]);

  // ── Filtered + searched tasks ──
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Category filter
    if (activeFilter !== 'all') {
      result = result.filter((t) => t.category === activeFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(query));
    }

    return result;
  }, [tasks, activeFilter, searchQuery]);

  // ── Handlers ──
  const handleTaskPress = useCallback(
    (task: Task) => {
      if (task.status === 'completed') return;
      router.push(`/focus/${task.id}`);
    },
    [router],
  );

  const handleTaskLongPress = useCallback(
    (task: Task) => {
      const actions: string[] = ['删除任务'];
      if (task.status !== 'completed') {
        actions.unshift('标记完成');
      }
      if (task.status === 'backlog') {
        actions.unshift('加入今天');
      }

      Alert.alert(task.title, '选择操作', [
        ...actions.map((action) => ({
          text: action,
          onPress: () => {
            if (action === '删除任务') {
              Alert.alert('确认删除', `确定要删除「${task.title}」吗？`, [
                { text: '取消', style: 'cancel' },
                {
                  text: '删除',
                  style: 'destructive',
                  onPress: () => deleteTask(task.id),
                },
              ]);
            } else if (action === '标记完成') {
              updateTaskStatus(task.id, 'completed');
            } else if (action === '加入今天') {
              updateTaskStatus(task.id, 'today');
            }
          },
        })),
        { text: '取消', style: 'cancel' },
      ]);
    },
    [deleteTask, updateTaskStatus],
  );

  // ── Filter chip width ──
  const filterChipWidth = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    return (screenWidth - 32 - 24) / 4; // 32 padding, 24 = 3 gaps * 8
  }, []);

  return (
    <View style={styles.root}>
      <ScreenBackdrop variant="home" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Title ──────────────────────────────────────────── */}
        <Text style={styles.title}>所有任务</Text>

        {/* ─── Search Bar ─────────────────────────────────────── */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索任务..."
            placeholderTextColor="#55556A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>

        {/* ─── Filter Chips ───────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_OPTIONS.map((option) => {
            const isActive = activeFilter === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(option.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── Task List ──────────────────────────────────────── */}
        {filteredTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() || activeFilter !== 'all'
                ? '没有匹配的任务'
                : '还没有任务'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim() || activeFilter !== 'all'
                ? '试试其他关键词或筛选条件'
                : '点击 + 开始创建第一个任务'}
            </Text>
          </View>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => handleTaskPress(task)}
              onLongPress={() => handleTaskLongPress(task)}
            />
          ))
        )}

        {/* Bottom spacer for tab bar */}
        <View style={styles.bottomSpacer} />
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
    gap: 12,
    paddingTop: 16,
    paddingBottom: 16,
  },
  // ─── Title ───────────────────────────────────────────────────
  title: {
    fontFamily: 'Syne',
    fontSize: 20,
    fontWeight: '700',
    color: '#E8E8F0',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  // ─── Search Bar ──────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#18181F',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 14,
    lineHeight: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#E8E8F0',
    lineHeight: 18,
    padding: 0,
  },
  // ─── Filter Chips ────────────────────────────────────────────
  filterScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  filterContent: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: '#333345',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: '#4F8EF7',
    borderColor: '#4F8EF7',
  },
  filterChipText: {
    fontFamily: 'DM Mono',
    fontSize: 10,
    color: '#8888A0',
    lineHeight: 13,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  // ─── Empty State ─────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 40,
    lineHeight: 44,
  },
  emptyTitle: {
    fontFamily: 'Syne',
    fontSize: 15,
    fontWeight: '600',
    color: '#E8E8F0',
    lineHeight: 20,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#55556A',
    lineHeight: 16,
  },
  // ─── Bottom Spacer ────────────────────────────────────────────
  bottomSpacer: {
    height: 68,
  },
});
