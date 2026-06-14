import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import { Svg, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useXPStore } from '../../store/xpStore';
import { useTaskStore } from '../../store/taskStore';
import { database } from '../../services/database';
import { BADGE_DEFINITIONS, MILESTONE_DEFINITIONS } from '../../constants/xp';
import ScreenBackdrop from '../../components/ScreenBackdrop';
import { useSvgId } from '../../components/useSvgId';
import type { Badge, Milestone } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────

/** Get the Monday of the current week (ISO week) */
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1; // shift to Monday
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

interface WeekDay {
  label: string;
  date: number;
  status: 'done' | 'today' | 'future';
}

// ─── Component ───────────────────────────────────────────────────
export default function Achievements() {
  const insets = useSafeAreaInsets();
  const { totalXP, streakDays, completedTasks, completedSteps, loadStats } =
    useXPStore();
  const { tasks } = useTaskStore();
  const [badges, setBadges] = useState<Badge[]>(BADGE_DEFINITIONS);
  const amberGlowId = useSvgId('achievementsAmberGlow');
  const blueGlowId = useSvgId('achievementsBlueGlow');
  const greenGlowId = useSvgId('achievementsGreenGlow');
  const milestoneGradId = useSvgId('achievementsMilestoneGrad');

  // Load data on mount
  useEffect(() => {
    loadStats();
    database
      .getAllBadges()
      .then((dbBadges) => {
        if (dbBadges && dbBadges.length > 0) {
          setBadges(dbBadges);
        }
      })
      .catch(() => {
        // Use definitions as fallback
      });
  }, [loadStats]);

  // ── Milestone with live progress ──
  const activeMilestone = useMemo<Milestone>(() => {
    const milestones = MILESTONE_DEFINITIONS.map((m) => {
      let current = 0;
      if (m.unit === 'levels') {
        current = Math.floor(totalXP / 100) + 1;
      } else if (m.unit === 'tasks') {
        current = completedTasks;
      } else if (m.unit === 'days') {
        current = streakDays;
      } else if (m.unit === 'XP') {
        current = totalXP;
      } else if (m.unit === 'sessions') {
        current = 0;
      } else if (m.unit === 'steps') {
        current = completedSteps;
      }
      return { ...m, current };
    });

    return (
      milestones.find((m) => m.current < m.target) || milestones[0]
    );
  }, [totalXP, completedTasks, completedSteps, streakDays]);

  const milestoneProgress = Math.min(
    1,
    activeMilestone.current / activeMilestone.target,
  );
  const milestonePercent = Math.round(milestoneProgress * 100);
  const milestoneRemaining = activeMilestone.target - activeMilestone.current;

  // ── Week calendar data ──
  const weekDays = useMemo<WeekDay[]>(() => {
    const weekStart = getWeekStart();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeDates = new Set(
      tasks
        .filter((t) => t.status === 'completed' && t.completedAt)
        .map((t) => {
          const d = new Date(t.completedAt!);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        }),
    );

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      d.setHours(0, 0, 0, 0);
      const isToday = d.getTime() === today.getTime();
      const isDone = activeDates.has(d.getTime()) && !isToday;
      const isFuture = d.getTime() > today.getTime();

      return {
        label: WEEK_LABELS[i],
        date: d.getDate(),
        status: isToday
          ? ('today' as const)
          : isDone
            ? ('done' as const)
            : ('future' as const),
      };
    });
  }, [tasks]);

  // ── Badge grid width calculation (3 columns) ──
  const badgeItemWidth = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    return (screenWidth - 32 - 16) / 3; // 32 = horizontal padding, 16 = 2 gaps * 8
  }, []);

  return (
    <View style={styles.root}>
      <ScreenBackdrop variant="achievements" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Title ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>我的成就</Text>
          <Text style={styles.subtitle}>本周表现不错 🎉</Text>
        </View>

        {/* ─── Stats Grid (3 columns) ─────────────────────────── */}
        <View style={styles.statGrid}>
          {/* XP Card */}
          <View style={styles.statCard}>
            <Svg
              style={StyleSheet.absoluteFill}
              width="100%"
              height="100%"
              preserveAspectRatio="none"
            >
              <Defs>
                <LinearGradient id={amberGlowId} x1="0.5" y1="0" x2="0.5" y2="0.7">
                  <Stop offset="0%" stopColor="#FBBF24" stopOpacity="0.15" />
                  <Stop offset="70%" stopColor="#FBBF24" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${amberGlowId})`} />
            </Svg>
            <Text style={styles.statIcon}>🔥</Text>
            <Text style={[styles.statNum, { color: '#FBBF24' }]}>{totalXP}</Text>
            <Text style={styles.statLbl}>总 XP</Text>
          </View>

          {/* Streak Card */}
          <View style={styles.statCard}>
            <Svg
              style={StyleSheet.absoluteFill}
              width="100%"
              height="100%"
              preserveAspectRatio="none"
            >
              <Defs>
                <LinearGradient id={blueGlowId} x1="0.5" y1="0" x2="0.5" y2="0.7">
                  <Stop offset="0%" stopColor="#4F8EF7" stopOpacity="0.18" />
                  <Stop offset="70%" stopColor="#4F8EF7" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${blueGlowId})`} />
            </Svg>
            <Text style={styles.statIcon}>⚡</Text>
            <Text style={[styles.statNum, { color: '#4F8EF7' }]}>{streakDays}</Text>
            <Text style={styles.statLbl}>连续天</Text>
          </View>

          {/* Completed Card */}
          <View style={styles.statCard}>
            <Svg
              style={StyleSheet.absoluteFill}
              width="100%"
              height="100%"
              preserveAspectRatio="none"
            >
              <Defs>
                <LinearGradient id={greenGlowId} x1="0.5" y1="0" x2="0.5" y2="0.7">
                  <Stop offset="0%" stopColor="#34D399" stopOpacity="0.15" />
                  <Stop offset="70%" stopColor="#34D399" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${greenGlowId})`} />
            </Svg>
            <Text style={styles.statIcon}>✓</Text>
            <Text style={[styles.statNum, { color: '#34D399' }]}>
              {completedTasks}
            </Text>
            <Text style={styles.statLbl}>完成项</Text>
          </View>
        </View>

        {/* ─── Badges ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>本周徽章</Text>
        <View style={styles.badgeGrid}>
          {badges.map((badge) => (
            <Pressable
              key={badge.id}
              style={({ pressed }) => [
                styles.badgeCard,
                pressed && styles.badgePressed,
                !badge.isUnlocked && styles.badgeLocked,
                { width: badgeItemWidth },
              ]}
            >
              {badge.isUnlocked && (
                <Svg
                  style={StyleSheet.absoluteFill}
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                >
                  <Defs>
                    <LinearGradient
                      id={`bg${badge.id}`}
                      x1="0.5"
                      y1="0"
                      x2="0.5"
                      y2="0.7"
                    >
                      <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.05" />
                      <Stop offset="70%" stopColor="#FFFFFF" stopOpacity="0" />
                    </LinearGradient>
                  </Defs>
                  <Rect width="100%" height="100%" fill={`url(#bg${badge.id})`} />
                </Svg>
              )}
              <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              <Text style={styles.badgeName}>{badge.name}</Text>
            </Pressable>
          ))}
        </View>

        {/* ─── Milestone ──────────────────────────────────────── */}
        <View style={styles.milestoneBlock}>
          <View style={styles.milestoneRow}>
            <Text style={styles.milestoneName}>{activeMilestone.name}</Text>
            <Text style={styles.milestoneFrac}>
              {activeMilestone.current} / {activeMilestone.target}{' '}
              {activeMilestone.unit}
            </Text>
          </View>
          <View style={styles.milestoneTrack}>
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
              <Defs>
                <LinearGradient
                  id={milestoneGradId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <Stop offset="0%" stopColor="#7C3AED" />
                  <Stop offset="100%" stopColor="#A78BFA" />
                </LinearGradient>
              </Defs>
              {milestonePercent > 0 && (
                <Rect
                  x="0"
                  y="0"
                  width={`${milestonePercent}%`}
                  height="100%"
                  rx="99"
                  ry="99"
                  fill={`url(#${milestoneGradId})`}
                />
              )}
            </Svg>
          </View>
          <Text style={styles.milestoneHint}>
            再完成 {milestoneRemaining} 个
            {activeMilestone.unit}解锁称号
          </Text>
        </View>

        {/* ─── Weekly Calendar ────────────────────────────────── */}
        <Text style={styles.sectionLabel}>本周打卡</Text>
        <View style={styles.calStrip}>
          {weekDays.map((day, i) => (
            <View key={i} style={styles.calDay}>
              <Text style={styles.calLabel}>{day.label}</Text>
              <View
                style={[
                  styles.calDot,
                  day.status === 'done' && styles.calDotDone,
                  day.status === 'today' && styles.calDotToday,
                  day.status === 'future' && styles.calDotFuture,
                ]}
              >
                <Text
                  style={[
                    styles.calNum,
                    day.status === 'done' && styles.calNumDone,
                    day.status === 'today' && styles.calNumToday,
                  ]}
                >
                  {day.date}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Bottom spacer for tab bar */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ─── Styles (matching prototype Screen 4 exactly) ─────────────────
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
  // ─── Header ───────────────────────────────────────────────────
  header: {
    gap: 2,
  },
  title: {
    fontFamily: 'Syne',
    fontSize: 15,
    fontWeight: '700',
    color: '#E8E8F0',
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 12,
    color: '#55556A',
    lineHeight: 16,
  },
  // ─── Stats Grid ───────────────────────────────────────────────
  statGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#18181F',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 2,
  },
  statIcon: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 2,
  },
  statNum: {
    fontFamily: 'Syne',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  statLbl: {
    fontFamily: 'DM Mono',
    fontSize: 8,
    color: '#55556A',
    lineHeight: 11,
    textAlign: 'center',
  },
  // ─── Badges ───────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: 'DM Mono',
    fontSize: 10,
    color: '#55556A',
    letterSpacing: 0.6,
    lineHeight: 13,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeCard: {
    backgroundColor: '#18181F',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  badgePressed: {
    transform: [{ scale: 0.96 }],
    borderColor: '#333345',
  },
  badgeLocked: {
    opacity: 0.35,
  },
  badgeEmoji: {
    fontSize: 24,
    lineHeight: 28,
  },
  badgeName: {
    fontFamily: 'DM Mono',
    fontSize: 8,
    color: '#8888A0',
    textAlign: 'center',
    lineHeight: 11,
  },
  // ─── Milestone ────────────────────────────────────────────────
  milestoneBlock: {
    backgroundColor: '#18181F',
    borderWidth: 1,
    borderColor: '#2A2A38',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  milestoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  milestoneName: {
    fontSize: 12,
    color: '#E8E8F0',
    fontWeight: '500',
    lineHeight: 16,
  },
  milestoneFrac: {
    fontFamily: 'DM Mono',
    fontSize: 10,
    color: '#55556A',
    lineHeight: 13,
  },
  milestoneTrack: {
    height: 6,
    backgroundColor: '#2A2A38',
    borderRadius: 99,
    overflow: 'hidden',
    position: 'relative',
  },
  milestoneHint: {
    fontSize: 10,
    color: '#55556A',
    lineHeight: 13,
  },
  // ─── Calendar Strip ───────────────────────────────────────────
  calStrip: {
    flexDirection: 'row',
    gap: 4,
  },
  calDay: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  calLabel: {
    fontFamily: 'DM Mono',
    fontSize: 8,
    color: '#55556A',
    lineHeight: 11,
  },
  calDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDotDone: {
    backgroundColor: '#4F8EF7',
    borderWidth: 1,
    borderColor: '#4F8EF7',
    shadowColor: 'rgba(79,142,247,0.4)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  calDotToday: {
    borderWidth: 1,
    borderColor: '#4F8EF7',
    backgroundColor: 'rgba(79,142,247,0.18)',
  },
  calDotFuture: {
    backgroundColor: '#1E1E28',
    borderWidth: 1,
    borderColor: '#2A2A38',
  },
  calNum: {
    fontFamily: 'DM Mono',
    fontSize: 8,
    color: '#55556A',
    lineHeight: 11,
  },
  calNumDone: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  calNumToday: {
    color: '#4F8EF7',
  },
  // ─── Bottom Spacer ────────────────────────────────────────────
  bottomSpacer: {
    height: 68,
  },
});
