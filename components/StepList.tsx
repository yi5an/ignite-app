import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Step } from '../types';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, fonts, glow, radii } from '../constants/theme';

// ─── Props ───────────────────────────────────────────────────────
interface StepListProps {
  steps: Step[];
  currentStepIndex: number;
}

// ─── Pulse Dot Component (current step indicator) ────────────────
function PulseDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.85, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.dotCurrent}>
      <Animated.View style={[styles.dotCurrentInner, animatedStyle]} />
    </View>
  );
}

// ─── StepList Component ──────────────────────────────────────────
export default function StepList({ steps, currentStepIndex }: StepListProps) {
  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const isDone = step.isCompleted;
        const isCurrent = index === currentStepIndex && !isDone;

        return (
          <View
            key={step.id}
            style={[styles.stepItem, isCurrent && styles.stepItemCurrent]}
          >
            {/* Step dot */}
            {isDone ? (
              <View style={styles.dotDone}>
                <Text style={styles.dotDoneText}>✓</Text>
              </View>
            ) : isCurrent ? (
              <PulseDot />
            ) : (
              <View style={styles.dotPending} />
            )}

            {/* Step text */}
            <Text
              style={[
                styles.stepText,
                isCurrent && styles.stepTextCurrent,
                isDone && styles.stepTextDone,
              ]}
              numberOfLines={1}
            >
              {step.title}
            </Text>

            {/* Step time */}
            <Text style={styles.stepMin}>{step.estimatedMinutes}分钟</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Styles (matching prototype .step-list, .step-item, .step-dot) ─
const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  stepItemCurrent: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.border2,
    shadowColor: colors.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  // ─── Done dot ─────────────────────────────────────────────────
  dotDone: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.green,
    borderWidth: 1.5,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: glow.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  dotDoneText: {
    fontSize: 9,
    color: '#000',
    fontWeight: '700',
    lineHeight: 10,
  },
  // ─── Current dot ──────────────────────────────────────────────
  dotCurrent: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.blue,
    backgroundColor: 'rgba(79,142,247,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCurrentInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.blue,
    shadowColor: colors.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  // ─── Pending dot ──────────────────────────────────────────────
  dotPending: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border2,
    backgroundColor: 'transparent',
  },
  // ─── Step text ────────────────────────────────────────────────
  stepText: {
    fontSize: 12,
    color: colors.text2,
    lineHeight: 16,
    flex: 1,
  },
  stepTextCurrent: {
    color: colors.text,
    fontWeight: '500',
  },
  stepTextDone: {
    textDecorationLine: 'line-through',
    color: colors.text3,
  },
  // ─── Step time ────────────────────────────────────────────────
  stepMin: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text3,
    lineHeight: 12,
  },
});
