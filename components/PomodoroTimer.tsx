import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Svg, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, fonts, radii } from '../constants/theme';
import { useSvgId } from './useSvgId';

// ─── Props ───────────────────────────────────────────────────────
interface PomodoroTimerProps {
  duration?: number; // total seconds, default 25*60
  isRunning: boolean;
  onTimerEnd?: () => void;
  onToggle?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────
const RADIUS = 55;
const STROKE_WIDTH = 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 345.58
const SIZE = (RADIUS + STROKE_WIDTH) * 2; // 118

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Helpers ─────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────
export default function PomodoroTimer({
  duration = 25 * 60,
  isRunning,
  onTimerEnd,
  onToggle,
}: PomodoroTimerProps) {
  const [displayTime, setDisplayTime] = useState(duration);
  const timeRemaining = useRef(duration);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onTimerEndRef = useRef(onTimerEnd);
  onTimerEndRef.current = onTimerEnd;

  // Animated progress (1 → 0 as time decreases)
  const progress = useSharedValue(1);
  const topGlowId = useSvgId('pomodoroTopGlow');
  const timerGradId = useSvgId('pomodoroTimerGrad');

  // ─── Timer Logic ─────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        timeRemaining.current -= 1;

        if (timeRemaining.current <= 0) {
          timeRemaining.current = 0;
          setDisplayTime(0);
          progress.value = 0;
          if (intervalRef.current) clearInterval(intervalRef.current);
          onTimerEndRef.current?.();
          return;
        }

        const remaining = timeRemaining.current;
        setDisplayTime(remaining);
        progress.value = remaining / duration;
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, duration, progress]);

  // Reset when duration changes
  useEffect(() => {
    timeRemaining.current = duration;
    setDisplayTime(duration);
    progress.value = 1;
  }, [duration, progress]);

  // ─── Animated strokeDashoffset ───────────────────────────────
  const animatedProps = useAnimatedProps(() => {
    const offset = CIRCUMFERENCE * (1 - progress.value);
    return {
      strokeDashoffset: offset,
    };
  });

  // ─── Render ──────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Radial gradient glow — SVG overlay for top-center blue glow */}
      <Svg
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.glowSvg]}
        width="100%"
        height="100%"
        viewBox="0 0 300 300"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id={topGlowId} x1="0.5" y1="0" x2="0.5" y2="0.7">
            <Stop offset="0%" stopColor="#4F8EF7" stopOpacity="0.18" />
            <Stop offset="100%" stopColor="#4F8EF7" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="300" height="300" fill={`url(#${topGlowId})`} />
      </Svg>

      {/* Timer ring */}
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.ringContainer,
          pressed && styles.ringContainerPressed,
        ]}
      >
        <Svg width={SIZE} height={SIZE} style={styles.svg}>
          <Defs>
            <LinearGradient id={timerGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#3B7BF5" />
              <Stop offset="100%" stopColor="#4F8EF7" />
            </LinearGradient>
          </Defs>

          {/* Background track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={colors.border}
            strokeWidth={STROKE_WIDTH}
          />

          {/* Progress arc */}
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={`url(#${timerGradId})`}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            rotation="-90"
            originX={SIZE / 2}
            originY={SIZE / 2}
            animatedProps={animatedProps}
          />
        </Svg>

        {/* Center time display */}
        <View style={styles.centerText} pointerEvents="none">
          <Text style={styles.timerDigits}>
            {formatTime(displayTime)}
          </Text>
        </View>
      </Pressable>

      {/* Session info */}
      <Text style={styles.sessionText}>
        第 1 个番茄
      </Text>

      {/* Focus label */}
      <Text style={styles.focusLabel}>
        {isRunning ? 'FOCUS · 番茄钟进行中' : 'TAP TIMER · 点击开始专注'}
      </Text>
    </View>
  );
}

// ─── Styles (matching prototype .timer-block + .timer-ring) ─────
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 3,
  },
  glowSvg: {
    pointerEvents: 'none',
  },
  ringContainer: {
    width: SIZE,
    height: SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  ringContainerPressed: {
    transform: [{ scale: 0.97 }],
  },
  svg: {
    position: 'absolute',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerDigits: {
    fontFamily: fonts.mono,
    fontSize: 28,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -1,
    lineHeight: 32,
  },
  sessionText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text3,
    lineHeight: 12,
  },
  focusLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.blue,
    letterSpacing: 0.8, // tracking-wider ≈ 0.08em
    lineHeight: 14,
  },
});
