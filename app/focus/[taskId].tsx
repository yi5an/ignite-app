import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
import { useSettingsStore } from '../../store/settingsStore';
import { database } from '../../services/database';
import { Task } from '../../types';
import PomodoroTimer from '../../components/PomodoroTimer';
import StepList from '../../components/StepList';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import ModeNavBar from '../../components/ModeNavBar';
import { useSvgId } from '../../components/useSvgId';

// ─── Category Labels ─────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  work: '工作',
  study: '学习',
  creative: '创意',
};

// ─── Focus Mode Component ────────────────────────────────────────
export default function FocusMode() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { tasks, todayTasks, completeCurrentStep, loadTodayTasks } = useTaskStore();
  const { pomodoroDuration } = useSettingsStore();
  const completeGradId = useSvgId('focusCompleteGrad');

  // Find the task from store
  const [dbTask, setDbTask] = useState<Task | null>(null);

  const task = useMemo(() => {
    return (
      todayTasks.find((t) => t.id === taskId) ||
      tasks.find((t) => t.id === taskId) ||
      dbTask
    );
  }, [taskId, todayTasks, tasks, dbTask]);

  // Fallback: load task from database if not found in store
  useEffect(() => {
    if (!task && taskId) {
      database.getTask(taskId).then((found) => {
        if (found) setDbTask(found);
      });
    }
  }, [taskId, task]);

  // Timer state (local to this page)
  const [isRunning, setIsRunning] = useState(false);

  // XP pop animation
  const xpPopOpacity = useSharedValue(0);
  const xpPopTranslateY = useSharedValue(0);

  const showXpPop = useCallback(() => {
    xpPopOpacity.value = 0;
    xpPopTranslateY.value = 0;
    xpPopOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 300 }),
    );
    xpPopTranslateY.value = withSequence(
      withTiming(-40, { duration: 700, easing: Easing.out(Easing.ease) }),
      withTiming(-80, { duration: 300 }),
    );
  }, [xpPopOpacity, xpPopTranslateY]);

  const xpPopStyle = useAnimatedStyle(() => ({
    opacity: xpPopOpacity.value,
    transform: [{ translateY: xpPopTranslateY.value }],
  }));

  // Calculate if all steps are completed
  const allCompleted = useMemo(() => {
    if (!task) return false;
    return task.steps.length > 0 && task.steps.every((s) => s.isCompleted);
  }, [task]);

  // ─── Complete Step Handler ─────────────────────────────────────
  const handleCompleteStep = useCallback(async () => {
    if (!task || allCompleted) return;

    // Show XP animation
    showXpPop();

    // Complete the current step via store (XP is awarded inside the store)
    await completeCurrentStep(task.id);
  }, [task, allCompleted, completeCurrentStep, showXpPop]);

  // ─── Skip Handler ─────────────────────────────────────────────
  const handleSkip = useCallback(() => {
    setIsRunning(false);
    router.back();
  }, [router]);

  // ─── Leave Focus ──────────────────────────────────────────────
  const handleLeave = useCallback(() => {
    Alert.alert('确认退出', '确定要离开专注模式吗？当前进度已保存。', [
      { text: '继续专注', style: 'cancel' },
      { text: '离开', style: 'destructive', onPress: () => router.back() },
    ]);
  }, [router]);

  // ─── Loading state ─────────────────────────────────────────────
  if (!task) {
    return (
      <View style={styles.root}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  const categoryLabel = CATEGORY_LABELS[task.category] || task.category;

  return (
    <View style={styles.root}>
      <ScreenBackdrop variant="focus" />

      {/* ─── XP Pop Animation ──────────────────────────────────── */}
      <Animated.Text style={[styles.xpPop, xpPopStyle]}>
        +20 XP ⚡
      </Animated.Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Back Button ────────────────────────────────────── */}
        <Pressable style={styles.backButton} onPress={handleLeave}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>离开专注</Text>
        </Pressable>

        {/* ─── Task Info ──────────────────────────────────────── */}
        <View style={styles.taskInfo}>
          <Text style={styles.taskName} numberOfLines={2}>
            {task.title}
          </Text>
          <Text style={styles.taskSubtitle}>
            {categoryLabel} · 预计 {task.estimatedMinutes} 分钟
          </Text>
        </View>

        {/* ─── Pomodoro Timer ─────────────────────────────────── */}
        <PomodoroTimer
          duration={pomodoroDuration * 60}
          isRunning={isRunning}
          onTimerEnd={() => setIsRunning(false)}
          onToggle={() => setIsRunning((prev) => !prev)}
        />

        {/* ─── Step List ──────────────────────────────────────── */}
        <StepList steps={task.steps} currentStepIndex={task.currentStepIndex} />

        {/* ─── Complete Button ────────────────────────────────── */}
        {allCompleted ? (
          <View style={styles.completeButtonDone}>
            <Text style={styles.completeTextDone}>🎉 所有步骤完成！</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.completeButton,
              pressed && styles.completeButtonPressed,
            ]}
            onPress={handleCompleteStep}
          >
            <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient id={completeGradId} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor="#3B7BF5" />
                  <Stop offset="100%" stopColor="#4F8EF7" />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                rx="16"
                ry="16"
                fill={`url(#${completeGradId})`}
              />
            </Svg>
            <Text style={styles.completeText}>完成当前步骤 · +20 XP</Text>
          </Pressable>
        )}

        {/* ─── Skip Button ────────────────────────────────────── */}
        <Pressable style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>跳过，先休息一下</Text>
        </Pressable>

        <View style={styles.navPush} />
        <ModeNavBar active="focus" />
      </ScrollView>
    </View>
  );
}

// ─── Styles (matching prototype Screen 2 exactly) ────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    position: 'relative',
  },
  // ─── Scroll ───────────────────────────────────────────────────
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  // ─── Back Button ──────────────────────────────────────────────
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backArrow: {
    fontSize: 16,
    color: '#55556A',
    lineHeight: 20,
  },
  backText: {
    fontSize: 12,
    color: '#55556A',
    lineHeight: 16,
  },
  // ─── Task Info ────────────────────────────────────────────────
  taskInfo: {
    gap: 3,
  },
  taskName: {
    fontFamily: 'Syne',
    fontSize: 15,
    fontWeight: '700',
    color: '#E8E8F0',
    lineHeight: 20,
  },
  taskSubtitle: {
    fontSize: 12,
    color: '#55556A',
    marginTop: 3,
    lineHeight: 16,
  },
  // ─── Complete Button ──────────────────────────────────────────
  completeButton: {
    width: '100%',
    backgroundColor: '#4F8EF7',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(79,142,247,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
    marginTop: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  completeButtonPressed: {
    transform: [{ translateY: 1 }, { scale: 0.99 }],
  },
  completeText: {
    fontFamily: 'Syne',
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 17,
  },
  // ─── Complete Button (all done) ───────────────────────────────
  completeButtonDone: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34D399',
    marginTop: 4,
    shadowColor: 'rgba(52,211,153,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  completeTextDone: {
    fontFamily: 'Syne',
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 17,
  },
  // ─── Skip Button ──────────────────────────────────────────────
  skipButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  skipText: {
    fontSize: 12,
    color: '#55556A',
    lineHeight: 16,
    textAlign: 'center',
  },
  // ─── Bottom Spacer ────────────────────────────────────────────
  navPush: {
    flex: 1,
    minHeight: 16,
  },
  // ─── XP Pop Animation ─────────────────────────────────────────
  xpPop: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    fontFamily: 'Syne',
    fontSize: 18,
    fontWeight: '800',
    color: '#FBBF24',
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: 999,
    textShadowColor: '#FBBF24',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  // ─── Loading ──────────────────────────────────────────────────
  loadingText: {
    fontFamily: 'DM Mono',
    fontSize: 12,
    color: '#55556A',
    textAlign: 'center',
    marginTop: 60,
  },
});
