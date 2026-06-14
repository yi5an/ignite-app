import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Svg, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Task } from '../types';
import { categoryTheme, colors, fonts, radii } from '../constants/theme';
import { useSvgId } from './useSvgId';

// ─── Props ───────────────────────────────────────────────────────
interface TaskCardProps {
  task: Task;
  onPress?: () => void;
  onLongPress?: () => void;
  showMinimalStep?: boolean;
}

// ─── Component ───────────────────────────────────────────────────
export default function TaskCard({
  task,
  onPress,
  onLongPress,
  showMinimalStep = false,
}: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const config = categoryTheme[task.category];
  const cardGlowId = useSvgId('taskCardGlow');
  const progressGradId = useSvgId('taskCardProgress');

  // Progress calculation
  const totalSteps = task.steps.length;
  const completedSteps = task.steps.filter((s) => s.isCompleted).length;
  const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;
  const progressPercent = Math.round(progress * 100);
  const hasNoCompleted = completedSteps === 0 && totalSteps > 0;
  const minimalCopy = task.minimalStep.startsWith('最小一步')
    ? task.minimalStep
    : `最小一步：${task.minimalStep}`;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
        isCompleted && styles.completed,
      ]}
    >
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={cardGlowId} x1="0" y1="0" x2="1" y2="0.35">
            <Stop offset="0%" stopColor={config.color} stopOpacity="0.10" />
            <Stop offset="44%" stopColor={config.color} stopOpacity="0.025" />
            <Stop offset="100%" stopColor={config.color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${cardGlowId})`} />
      </Svg>

      {/* Left color bar */}
      <View
        style={[
          styles.leftBar,
          { backgroundColor: config.color, shadowColor: config.color },
        ]}
      />

      {/* Row 1: Title + Tag */}
      <View style={styles.row1}>
        <Text
          style={[styles.title, isCompleted && styles.titleCompleted]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <View
          style={[
            styles.tag,
            {
              backgroundColor: config.bg,
              borderColor: config.border,
            },
          ]}
        >
          <Text style={[styles.tagText, { color: config.color }]}>
            {config.shortLabel}
          </Text>
        </View>
      </View>

      {/* Row 2: Progress bar with SVG gradient */}
      <View style={styles.row2}>
        <View style={styles.progTrack}>
          {progressPercent > 0 && (
            <Svg style={styles.progSvg} width="100%" height="100%">
              <Defs>
                <LinearGradient
                  id={progressGradId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <Stop offset="0%" stopColor={config.color2} />
                  <Stop offset="100%" stopColor={config.color} />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={`${progressPercent}%`}
                height="100%"
                rx="99"
                ry="99"
                fill={`url(#${progressGradId})`}
              />
            </Svg>
          )}
        </View>
        <Text style={styles.progLabel}>
          {completedSteps} / {totalSteps} 步
        </Text>
      </View>

      {/* Conditional: Minimal Step */}
      {showMinimalStep && hasNoCompleted && task.minimalStep && (
        <View style={styles.minimalStep}>
          <View style={styles.minimalDot} />
          <Text style={styles.minimalText} numberOfLines={1}>
            {minimalCopy}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Styles (matching prototype .task-card exactly) ─────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 2,
  },
  containerPressed: {
    transform: [{ scale: 0.985 }, { translateX: 2 }],
    backgroundColor: colors.card2,
    borderColor: colors.border2,
  },
  completed: {
    opacity: 0.5,
  },
  leftBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  row1: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 17,
    flex: 1,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 13,
  },
  row2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progTrack: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  progLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.text3,
    lineHeight: 12,
  },
  minimalStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border2,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  minimalDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  minimalText: {
    fontSize: 11,
    color: colors.text2,
    lineHeight: 15,
    flex: 1,
  },
});
