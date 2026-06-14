import type { Badge, Milestone } from '../types';

// ─── Badge Definitions ────────────────────────────────────────────
// Matching prototype Screen 4 (Achievements) exactly

export const BADGE_DEFINITIONS: Badge[] = [
  {
    id: 'launcher',
    name: '启动者 ×3',
    emoji: '⚡',
    description: '连续3天完成至少一个任务',
    isUnlocked: true,
    unlockedAt: '2026-04-15T00:00:00.000Z',
    condition: 'streak_3',
  },
  {
    id: 'attendance',
    name: '连续出勤',
    emoji: '🗓️',
    description: '连续打卡7天',
    isUnlocked: true,
    unlockedAt: '2026-04-16T00:00:00.000Z',
    condition: 'streak_7',
  },
  {
    id: 'creative',
    name: '创意开花',
    emoji: '🎨',
    description: '完成第一个创意类任务',
    isUnlocked: true,
    unlockedAt: '2026-04-14T00:00:00.000Z',
    condition: 'first_creative',
  },
  {
    id: 'executor',
    name: '执行达人',
    emoji: '🚀',
    description: '完成20个步骤',
    isUnlocked: false,
    condition: 'steps_20',
  },
  {
    id: 'monthly_champ',
    name: '月度冠军',
    emoji: '🏆',
    description: '单月完成15个任务',
    isUnlocked: false,
    condition: 'monthly_15',
  },
  {
    id: 'hundred_steps',
    name: '百步俱乐部',
    emoji: '💎',
    description: '累计完成100个步骤',
    isUnlocked: false,
    condition: 'steps_100',
  },
];

// ─── Milestone Definitions ────────────────────────────────────────
// Ordered by progression; the first one where current < target is "active"

export const MILESTONE_DEFINITIONS: Milestone[] = [
  {
    id: 'm1',
    name: '初次点燃',
    current: 0,
    target: 1,
    unit: 'tasks',
    reward: '新手称号',
  },
  {
    id: 'm2',
    name: '执行达人',
    current: 0,
    target: 20,
    unit: 'steps',
    reward: '达人称号',
  },
  {
    id: 'm3',
    name: '连续7天',
    current: 0,
    target: 7,
    unit: 'days',
    reward: '坚持者称号',
  },
  {
    id: 'm4',
    name: '效率专家',
    current: 0,
    target: 50,
    unit: 'steps',
    reward: '专家称号',
  },
  {
    id: 'm5',
    name: '学霸之路',
    current: 0,
    target: 100,
    unit: 'XP',
    reward: '学霸称号',
  },
  {
    id: 'm6',
    name: '大师之路',
    current: 0,
    target: 10,
    unit: 'levels',
    reward: '大师称号',
  },
];

// ─── Badge unlock condition checkers ──────────────────────────────

export function checkBadgeUnlocks(params: {
  streakDays: number;
  completedTasks: number;
  completedSteps: number;
  totalXP: number;
}): string[] {
  const { streakDays, completedTasks, completedSteps, totalXP } = params;
  const newlyUnlocked: string[] = [];

  const conditions: Record<string, boolean> = {
    streak_3: streakDays >= 3,
    streak_7: streakDays >= 7,
    streak_30: streakDays >= 30,
    first_creative: completedTasks >= 1, // simplified; ideally check category
    steps_20: completedSteps >= 20,
    steps_50: completedSteps >= 50,
    steps_100: completedSteps >= 100,
    tasks_10: completedTasks >= 10,
    monthly_15: completedTasks >= 15,
    xp_500: totalXP >= 500,
    xp_1000: totalXP >= 1000,
  };

  for (const [condition, met] of Object.entries(conditions)) {
    if (met) {
      newlyUnlocked.push(condition);
    }
  }

  return newlyUnlocked;
}
