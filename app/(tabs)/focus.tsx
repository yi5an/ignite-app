import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import PomodoroTimer from '../../components/PomodoroTimer';
import StepList from '../../components/StepList';
import { useTaskStore } from '../../store/taskStore';
import { useSettingsStore } from '../../store/settingsStore';
import { categoryTheme, colors, fonts } from '../../constants/theme';

export default function FocusTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { todayTasks, tasks, isLoading, loadTodayTasks, loadAllTasks, completeCurrentStep } =
    useTaskStore();
  const { pomodoroDuration } = useSettingsStore();
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    loadTodayTasks();
    loadAllTasks();
  }, [loadTodayTasks, loadAllTasks]);

  const task = useMemo(() => {
    const todayCandidate = todayTasks.find((item) => item.status !== 'completed');
    if (todayCandidate) return todayCandidate;

    return tasks.find((item) => item.status !== 'completed') ?? null;
  }, [todayTasks, tasks]);

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

  const allCompleted = useMemo(() => {
    if (!task) return false;
    return task.steps.length > 0 && task.steps.every((step) => step.isCompleted);
  }, [task]);

  const handleCompleteStep = useCallback(async () => {
    if (!task || allCompleted) return;

    showXpPop();
    await completeCurrentStep(task.id);
  }, [task, allCompleted, showXpPop, completeCurrentStep]);

  if (isLoading && !task) {
    return (
      <View style={styles.root}>
        <ScreenBackdrop variant="focus" />
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.blue} />
          <Text style={styles.emptySubtitle}>正在寻找可专注的任务...</Text>
        </View>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.root}>
        <ScreenBackdrop variant="focus" />
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🎯</Text>
          <Text style={styles.emptyTitle}>还没有可专注的任务</Text>
          <Text style={styles.emptySubtitle}>先创建一个目标，专注入口会自动接上它。</Text>
          <Pressable
            style={({ pressed }) => [
              styles.createButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/new')}
          >
            <Text style={styles.createText}>新建目标</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const category = categoryTheme[task.category];

  return (
    <View style={styles.root}>
      <ScreenBackdrop variant="focus" />

      <Animated.Text style={[styles.xpPop, xpPopStyle]}>+20 XP ⚡</Animated.Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.backText}>‹ 离开专注</Text>
          <Text style={styles.taskName} numberOfLines={2}>
            {task.title}
          </Text>
          <Text style={styles.taskSubtitle}>
            {category.label} · 预计 {task.estimatedMinutes} 分钟
          </Text>
        </View>

        <PomodoroTimer
          duration={pomodoroDuration * 60}
          isRunning={isRunning}
          onTimerEnd={() => setIsRunning(false)}
          onToggle={() => setIsRunning((prev) => !prev)}
        />

        <StepList steps={task.steps} currentStepIndex={task.currentStepIndex} />

        {allCompleted ? (
          <View style={styles.completeButtonDone}>
            <Text style={styles.completeText}>🎉 所有步骤完成！</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.completeButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleCompleteStep}
          >
            <Text style={styles.completeText}>完成当前步骤 · +20 XP</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.skipButton, pressed && styles.skipPressed]}
          onPress={() => router.push('/')}
        >
          <Text style={styles.skipText}>跳过，先休息一下</Text>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
    paddingBottom: 92,
  },
  header: {
    gap: 3,
  },
  backText: {
    fontSize: 12,
    color: colors.text3,
    lineHeight: 18,
    marginBottom: 8,
  },
  taskName: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  taskSubtitle: {
    fontSize: 12,
    color: colors.text3,
    lineHeight: 16,
  },
  completeButton: {
    width: '100%',
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.blue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 5,
  },
  completeButtonDone: {
    width: '100%',
    backgroundColor: colors.green,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipPressed: {
    backgroundColor: colors.card2,
  },
  skipText: {
    fontSize: 12,
    color: colors.text3,
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }, { translateY: 1 }],
  },
  bottomSpacer: {
    height: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyEmoji: {
    fontSize: 42,
    lineHeight: 48,
  },
  emptyTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.text3,
    textAlign: 'center',
    lineHeight: 18,
  },
  createButton: {
    marginTop: 8,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  createText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  xpPop: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    fontFamily: fonts.headingExtra,
    fontSize: 18,
    fontWeight: '800',
    color: colors.amber,
    pointerEvents: 'none',
    zIndex: 999,
    textShadowColor: colors.amber,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
});
