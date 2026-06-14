// XP store using zustand
import { create } from 'zustand';
import { XPRecord } from '../types';
import { database } from '../services/database';

const XP_PER_LEVEL = 100;

interface XPState {
  totalXP: number;
  level: number;
  streakDays: number;
  completedTasks: number;
  completedSteps: number;
  recentRecords: XPRecord[];

  // Actions
  loadStats: () => Promise<void>;
  addXP: (amount: number, source: XPRecord['source'], taskId?: string) => Promise<void>;
  updateStreak: () => Promise<void>;
  getLevel: () => number;
  getLevelProgress: () => number;
}

export const useXPStore = create<XPState>((set, get) => ({
  totalXP: 0,
  level: 1,
  streakDays: 0,
  completedTasks: 0,
  completedSteps: 0,
  recentRecords: [],

  loadStats: async () => {
    try {
      const stats = await database.getStats();
      const level = Math.floor(stats.totalXP / XP_PER_LEVEL) + 1;

      // Load recent XP records
      let recentRecords: XPRecord[] = [];
      try {
        recentRecords = await database.getRecentXPRecords(20);
      } catch {
        // getRecentXPRecords might not be available yet, ignore
      }

      set({
        totalXP: stats.totalXP,
        level,
        streakDays: stats.streakDays,
        completedTasks: stats.completedTasks,
        completedSteps: stats.completedSteps,
        recentRecords,
      });
    } catch (error) {
      console.error('[xpStore] loadStats failed:', error);
    }
  },

  addXP: async (amount, source, taskId) => {
    try {
      await database.addXP(amount, source, taskId);

      // Reload stats from DB to get accurate totalXP
      const stats = await database.getStats();
      const newTotalXP = stats.totalXP;
      const newLevel = Math.floor(newTotalXP / XP_PER_LEVEL) + 1;
      const oldLevel = get().level;

      // Update recent records
      const newRecord: XPRecord = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
        amount,
        source,
        taskId,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({
        totalXP: newTotalXP,
        level: newLevel,
        recentRecords: [newRecord, ...state.recentRecords].slice(0, 20),
      }));

      // Level up notification
      if (newLevel > oldLevel) {
        console.log(`[xpStore] Level up! ${oldLevel} -> ${newLevel}`);
        // Animation/event can be triggered via an event emitter or callback
        // For now we log — the UI layer can subscribe to level changes
      }
    } catch (error) {
      console.error('[xpStore] addXP failed:', error);
    }
  },

  updateStreak: async () => {
    try {
      const stats = await database.getStats();

      // Use consistent local time for all date calculations
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      const lastActive = stats.lastActiveDate.split('T')[0];

      let newStreak: number;

      if (lastActive === todayStr) {
        // Already active today, no change
        return;
      }

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      if (lastActive === yesterdayStr) {
        // Consecutive day, increment streak
        newStreak = stats.streakDays + 1;
      } else {
        // Streak broken, reset to 1
        newStreak = 1;
      }

      await database.updateStats({
        streakDays: newStreak,
        lastActiveDate: todayStr,
      });

      set({ streakDays: newStreak });

      // Bonus XP for streak milestones
      if (newStreak > 0 && newStreak % 7 === 0) {
        console.log(`[xpStore] Streak milestone! ${newStreak} days — bonus XP!`);
        await database.addXP(newStreak * 2, 'streak');
      }
    } catch (error) {
      console.error('[xpStore] updateStreak failed:', error);
    }
  },

  getLevel: () => {
    const { totalXP } = get();
    return Math.floor(totalXP / XP_PER_LEVEL) + 1;
  },

  getLevelProgress: () => {
    const { totalXP } = get();
    const currentLevelXP = (Math.floor(totalXP / XP_PER_LEVEL)) * XP_PER_LEVEL;
    const nextLevelXP = currentLevelXP + XP_PER_LEVEL;
    const progress = totalXP - currentLevelXP;
    return (progress / XP_PER_LEVEL) * 100;
  },
}));
