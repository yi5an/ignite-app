import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTaskStore } from '../../store/taskStore';
import { useXPStore } from '../../store/xpStore';
import TaskCard from '../../components/TaskCard';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import { useSvgId } from '../../components/useSvgId';

// ─── Helpers ─────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好 👋';
  if (hour < 18) return '下午好 👋';
  return '晚上好 👋';
}

function getWeekDay(): string {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[new Date().getDay()];
}

// ─── Animated Flame ──────────────────────────────────────────────
function AnimatedFlame() {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${Math.sin(scale.value) * 2}deg` },
    ],
  }));

  return (
    <Animated.Text style={[styles.flameIcon, animatedStyle]}>🔥</Animated.Text>
  );
}

// ─── TodayView Component ────────────────────────────────────────
export default function TodayView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayTasks, loadTodayTasks } = useTaskStore();
  const { streakDays, totalXP, loadStats } = useXPStore();
  const streakGlowId = useSvgId('todayStreakGlow');
  const fabGradId = useSvgId('todayFabGrad');

  // Load data on mount
  useEffect(() => {
    loadTodayTasks();
    loadStats();
  }, [loadTodayTasks, loadStats]);

  // Find the first incomplete task for minimal step display
  const firstIncompleteIndex = useMemo(
    () =>
      todayTasks.findIndex((t) => {
        const completedSteps = t.steps.filter((s) => s.isCompleted).length;
        return completedSteps === 0 && t.status !== 'completed';
      }),
    [todayTasks],
  );

  const pendingCount = todayTasks.filter((t) => t.status !== 'completed').length;

  return (
    <View style={styles.root}>
      <ScreenBackdrop variant="home" />

      {/* ─── Fixed Top: Greeting + Streak ──────────────────────── */}
      <View style={[styles.topSection, { paddingTop: insets.top + 10 }]}>
        {/* Greeting */}
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.subtitle}>
          {getWeekDay()} ·{' '}
          {pendingCount > 0
            ? `你有 ${pendingCount} 件事等待点燃`
            : '今天没有待办事项'}
        </Text>

        {/* Streak Bar */}
        <View style={styles.streakBar}>
          {/* Left gradient glow overlay via SVG */}
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id={streakGlowId} x1="0" y1="0.5" x2="0.6" y2="0.5">
                <Stop offset="0%" stopColor="#FBBF24" stopOpacity="0.15" />
                <Stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${streakGlowId})`} />
          </Svg>

          {/* Content (above the gradient) */}
          <AnimatedFlame />
          <Text style={styles.streakNum}>{streakDays}</Text>
          <Text style={styles.streakLabel}>天连续打卡</Text>
          <View style={styles.streakXpBadge}>
            <Text style={styles.streakXp}>+{Math.min(totalXP, 50)} XP 今日</Text>
          </View>
        </View>
      </View>

      {/* ─── Scrollable Task List ─────────────────────────────── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {todayTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyTitle}>今天还没有任务</Text>
            <Text style={styles.emptySubtitle}>点击右下角 + 开始创建</Text>
          </View>
        ) : (
          todayTasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              showMinimalStep={index === firstIncompleteIndex}
              onPress={() => router.push(`/focus/${task.id}`)}
            />
          ))
        )}

        {/* Bottom spacer for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ─── FAB ───────────────────────────────────────────────── */}
      <Pressable
        style={[
          styles.fab,
          { bottom: 68 + insets.bottom + 16 },
        ]}
        hitSlop={12}
        onPress={() => router.push('/new')}
      >
        {/* FAB gradient via SVG */}
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={fabGradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#3B7BF5" />
              <Stop offset="100%" stopColor="#4F8EF7" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" rx="22" ry="22" fill={`url(#${fabGradId})`} />
        </Svg>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles (matching prototype Screen 1 exactly) ────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    position: 'relative',
  },
  // ─── Top Section (fixed, not scrollable) ──────────────────────
  topSection: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  greeting: {
    fontFamily: 'Syne',
    fontSize: 20,
    fontWeight: '700',
    color: '#E8E8F0',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 12,
    color: '#55556A',
    marginTop: 2,
    lineHeight: 16,
  },
  // ─── Streak Bar ──────────────────────────────────────────────
  streakBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181F',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  flameIcon: {
    fontSize: 16,
    lineHeight: 20,
  },
  streakNum: {
    fontFamily: 'Syne',
    fontSize: 15,
    fontWeight: '700',
    color: '#FBBF24',
    lineHeight: 19,
  },
  streakLabel: {
    fontSize: 11,
    color: '#55556A',
    lineHeight: 14,
  },
  streakXpBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(251,191,36,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  streakXp: {
    fontFamily: 'DM Mono',
    fontSize: 11,
    color: '#FBBF24',
    lineHeight: 14,
  },
  // ─── Scrollable Area ─────────────────────────────────────────
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    gap: 12,
    paddingTop: 4,
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
  // ─── Bottom Spacer ───────────────────────────────────────────
  bottomSpacer: {
    height: 68 + 80,
  },
  // ─── FAB ─────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(79,142,247,0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 20,
    overflow: 'hidden',
  },
  fabText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 24,
    textAlign: 'center',
  },
});
