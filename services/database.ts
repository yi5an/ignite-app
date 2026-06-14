import * as SQLite from 'expo-sqlite';
import { Task, Step, XPRecord, UserStats, Badge, KnowledgeEntry, KnowledgeEntryType, KnowledgeSyncStatus } from '../types';

const DB_NAME = 'ignite.db';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

class Database {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
      console.log('[DB] Database initialized');
    } catch (error) {
      console.error('[DB] Failed to initialize:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          category TEXT NOT NULL CHECK(category IN ('work', 'study', 'creative')),
          status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('today', 'backlog', 'completed', 'archived')),
          current_step_index INTEGER NOT NULL DEFAULT 0,
          estimated_minutes INTEGER NOT NULL DEFAULT 0,
          minimal_step TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT,
          xp_earned INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS steps (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL,
          title TEXT NOT NULL,
          estimated_minutes INTEGER NOT NULL DEFAULT 0,
          is_completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          "order" INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_steps_task_id ON steps(task_id);

        CREATE TABLE IF NOT EXISTS xp_records (
          id TEXT PRIMARY KEY NOT NULL,
          amount INTEGER NOT NULL,
          source TEXT NOT NULL CHECK(source IN ('task', 'pomodoro', 'practice', 'exam', 'streak')),
          task_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_xp_records_created_at ON xp_records(created_at);

        CREATE TABLE IF NOT EXISTS user_stats (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          total_xp INTEGER NOT NULL DEFAULT 0,
          level INTEGER NOT NULL DEFAULT 1,
          streak_days INTEGER NOT NULL DEFAULT 0,
          completed_tasks INTEGER NOT NULL DEFAULT 0,
          completed_steps INTEGER NOT NULL DEFAULT 0,
          last_active_date TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS badges (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          emoji TEXT NOT NULL,
          description TEXT NOT NULL,
          is_unlocked INTEGER NOT NULL DEFAULT 0,
          unlocked_at TEXT,
          condition TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS knowledge_entries (
          id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('plans', 'notes', 'practice', 'summaries')),
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          related_task_id TEXT,
          sync_status TEXT NOT NULL DEFAULT 'local' CHECK(sync_status IN ('local', 'queued', 'synced')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (related_task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_knowledge_entries_type_created_at
        ON knowledge_entries(type, created_at DESC);
      `);

      // Ensure single user_stats row exists
      await this.db.runAsync(
        `INSERT OR IGNORE INTO user_stats (id) VALUES (1)`
      );

      console.log('[DB] Tables created/verified');
    } catch (error) {
      console.error('[DB] Failed to create tables:', error);
      throw error;
    }
  }

  // ─── Task CRUD ─────────────────────────────────────────────

  async createTask(task: Omit<Task, 'id'>): Promise<Task> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const id = generateId();
      const now = new Date().toISOString();

      await this.db.runAsync(
        `INSERT INTO tasks (id, title, category, status, current_step_index, estimated_minutes, minimal_step, created_at, completed_at, xp_earned)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        task.title,
        task.category,
        task.status,
        task.currentStepIndex,
        task.estimatedMinutes,
        task.minimalStep,
        task.createdAt || now,
        task.completedAt || null,
        task.xpEarned,
      );

      // Insert steps
      for (const step of task.steps) {
        await this.db.runAsync(
          `INSERT INTO steps (id, task_id, title, estimated_minutes, is_completed, completed_at, "order")
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          step.id || generateId(),
          id,
          step.title,
          step.estimatedMinutes,
          step.isCompleted ? 1 : 0,
          step.completedAt || null,
          step.order,
        );
      }

      const created = await this.getTask(id);
      return created!;
    } catch (error) {
      console.error('[DB] createTask failed:', error);
      throw error;
    }
  }

  async getTask(id: string): Promise<Task | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const row = await this.db.getFirstAsync<any>(
        `SELECT * FROM tasks WHERE id = ?`,
        id,
      );

      if (!row) return null;

      const steps = await this.db.getAllAsync<any>(
        `SELECT * FROM steps WHERE task_id = ? ORDER BY "order" ASC`,
        id,
      );

      return this.mapRowToTask(row, steps);
    } catch (error) {
      console.error('[DB] getTask failed:', error);
      throw error;
    }
  }

  async getTodayTasks(): Promise<Task[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const rows = await this.db.getAllAsync<any>(
        `SELECT * FROM tasks WHERE status = 'today' ORDER BY created_at DESC LIMIT 3`
      );

      return await Promise.all(
        rows.map(async (row) => {
          const steps = await this.db!.getAllAsync<any>(
            `SELECT * FROM steps WHERE task_id = ? ORDER BY "order" ASC`,
            row.id,
          );
          return this.mapRowToTask(row, steps);
        }),
      );
    } catch (error) {
      console.error('[DB] getTodayTasks failed:', error);
      throw error;
    }
  }

  async getAllTasks(): Promise<Task[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const rows = await this.db.getAllAsync<any>(
        `SELECT * FROM tasks ORDER BY
          CASE status
            WHEN 'today' THEN 0
            WHEN 'backlog' THEN 1
            WHEN 'completed' THEN 2
            WHEN 'archived' THEN 3
          END,
          created_at DESC`
      );

      return await Promise.all(
        rows.map(async (row) => {
          const steps = await this.db!.getAllAsync<any>(
            `SELECT * FROM steps WHERE task_id = ? ORDER BY "order" ASC`,
            row.id,
          );
          return this.mapRowToTask(row, steps);
        }),
      );
    } catch (error) {
      console.error('[DB] getAllTasks failed:', error);
      throw error;
    }
  }

  async updateTask(task: Partial<Task> & { id: string }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (task.title !== undefined) { fields.push('title = ?'); values.push(task.title); }
      if (task.category !== undefined) { fields.push('category = ?'); values.push(task.category); }
      if (task.status !== undefined) { fields.push('status = ?'); values.push(task.status); }
      if (task.currentStepIndex !== undefined) { fields.push('current_step_index = ?'); values.push(task.currentStepIndex); }
      if (task.estimatedMinutes !== undefined) { fields.push('estimated_minutes = ?'); values.push(task.estimatedMinutes); }
      if (task.minimalStep !== undefined) { fields.push('minimal_step = ?'); values.push(task.minimalStep); }
      if (task.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(task.completedAt); }
      if (task.xpEarned !== undefined) { fields.push('xp_earned = ?'); values.push(task.xpEarned); }

      if (fields.length === 0) return;

      values.push(task.id);
      await this.db.runAsync(
        `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
        ...values,
      );
    } catch (error) {
      console.error('[DB] updateTask failed:', error);
      throw error;
    }
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.runAsync('DELETE FROM steps WHERE task_id = ?', id);
      await this.db.runAsync('DELETE FROM tasks WHERE id = ?', id);
    } catch (error) {
      console.error('[DB] deleteTask failed:', error);
      throw error;
    }
  }

  async setTodayTasks(taskIds: string[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Reset all today tasks to backlog
      await this.db.runAsync(
        `UPDATE tasks SET status = 'backlog' WHERE status = 'today'`
      );

      // Set the selected tasks as today (max 3)
      const ids = taskIds.slice(0, 3);
      for (const id of ids) {
        await this.db.runAsync(
          `UPDATE tasks SET status = 'today' WHERE id = ?`,
          id,
        );
      }
    } catch (error) {
      console.error('[DB] setTodayTasks failed:', error);
      throw error;
    }
  }

  // ─── Step CRUD ─────────────────────────────────────────────

  async completeStep(stepId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const now = new Date().toISOString();
      await this.db.runAsync(
        `UPDATE steps SET is_completed = 1, completed_at = ? WHERE id = ?`,
        now,
        stepId,
      );
    } catch (error) {
      console.error('[DB] completeStep failed:', error);
      throw error;
    }
  }

  async updateSteps(steps: Step[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      for (const step of steps) {
        await this.db.runAsync(
          `UPDATE steps SET title = ?, estimated_minutes = ?, is_completed = ?, completed_at = ?, "order" = ?
           WHERE id = ?`,
          step.title,
          step.estimatedMinutes,
          step.isCompleted ? 1 : 0,
          step.completedAt || null,
          step.order,
          step.id,
        );
      }
    } catch (error) {
      console.error('[DB] updateSteps failed:', error);
      throw error;
    }
  }

  // ─── XP ────────────────────────────────────────────────────

  async addXP(amount: number, source: XPRecord['source'], taskId?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const id = generateId();
      const now = new Date().toISOString();

      await this.db.runAsync(
        `INSERT INTO xp_records (id, amount, source, task_id, created_at) VALUES (?, ?, ?, ?, ?)`,
        id,
        amount,
        source,
        taskId || null,
        now,
      );

      // Update total XP
      await this.db.runAsync(
        `UPDATE user_stats SET total_xp = total_xp + ? WHERE id = 1`,
        amount,
      );
    } catch (error) {
      console.error('[DB] addXP failed:', error);
      throw error;
    }
  }

  async getRecentXPRecords(limit: number = 20): Promise<XPRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    try {
      const rows = await this.db.getAllAsync<any>(
        `SELECT * FROM xp_records ORDER BY created_at DESC LIMIT ?`,
        limit,
      );
      return rows.map((row) => ({
        id: row.id,
        amount: row.amount,
        source: row.source,
        taskId: row.task_id || undefined,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('[DB] getRecentXPRecords failed:', error);
      throw error;
    }
  }

  async getTotalXP(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const row = await this.db.getFirstAsync<{ total_xp: number }>(
        `SELECT total_xp FROM user_stats WHERE id = 1`
      );
      return row?.total_xp ?? 0;
    } catch (error) {
      console.error('[DB] getTotalXP failed:', error);
      throw error;
    }
  }

  async getStreakDays(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const row = await this.db.getFirstAsync<{ streak_days: number }>(
        `SELECT streak_days FROM user_stats WHERE id = 1`
      );
      return row?.streak_days ?? 0;
    } catch (error) {
      console.error('[DB] getStreakDays failed:', error);
      throw error;
    }
  }

  // ─── Stats ─────────────────────────────────────────────────

  async getStats(): Promise<UserStats> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const row = await this.db.getFirstAsync<any>(
        `SELECT * FROM user_stats WHERE id = 1`
      );

      if (!row) {
        return {
          totalXP: 0,
          level: 1,
          streakDays: 0,
          completedTasks: 0,
          completedSteps: 0,
          lastActiveDate: '',
        };
      }

      return {
        totalXP: row.total_xp,
        level: row.level,
        streakDays: row.streak_days,
        completedTasks: row.completed_tasks,
        completedSteps: row.completed_steps,
        lastActiveDate: row.last_active_date,
      };
    } catch (error) {
      console.error('[DB] getStats failed:', error);
      throw error;
    }
  }

  async updateStats(stats: Partial<UserStats>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (stats.totalXP !== undefined) { fields.push('total_xp = ?'); values.push(stats.totalXP); }
      if (stats.level !== undefined) { fields.push('level = ?'); values.push(stats.level); }
      if (stats.streakDays !== undefined) { fields.push('streak_days = ?'); values.push(stats.streakDays); }
      if (stats.completedTasks !== undefined) { fields.push('completed_tasks = ?'); values.push(stats.completedTasks); }
      if (stats.completedSteps !== undefined) { fields.push('completed_steps = ?'); values.push(stats.completedSteps); }
      if (stats.lastActiveDate !== undefined) { fields.push('last_active_date = ?'); values.push(stats.lastActiveDate); }

      if (fields.length === 0) return;

      await this.db.runAsync(
        `UPDATE user_stats SET ${fields.join(', ')} WHERE id = 1`,
        ...values,
      );
    } catch (error) {
      console.error('[DB] updateStats failed:', error);
      throw error;
    }
  }

  // ─── Settings ──────────────────────────────────────────────

  async getSetting(key: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');
    try {
      const row = await this.db.getFirstAsync<{ value: string }>(
        `SELECT value FROM settings WHERE key = ?`,
        key,
      );
      return row?.value ?? null;
    } catch (error) {
      console.error('[DB] getSetting failed:', error);
      throw error;
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    try {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        key,
        value,
      );
    } catch (error) {
      console.error('[DB] setSetting failed:', error);
      throw error;
    }
  }

  async getAllSettings(): Promise<Record<string, string>> {
    if (!this.db) throw new Error('Database not initialized');
    try {
      const rows = await this.db.getAllAsync<{ key: string; value: string }>(
        `SELECT key, value FROM settings`,
      );
      const result: Record<string, string> = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }
      return result;
    } catch (error) {
      console.error('[DB] getAllSettings failed:', error);
      throw error;
    }
  }

  // ─── Knowledge Entries ────────────────────────────────────

  async createKnowledgeEntry(
    entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KnowledgeEntry> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const id = generateId();
      const now = new Date().toISOString();

      await this.db.runAsync(
        `INSERT INTO knowledge_entries (
          id, type, title, content, related_task_id, sync_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        entry.type,
        entry.title,
        entry.content,
        entry.relatedTaskId || null,
        entry.syncStatus,
        now,
        now,
      );

      const created = await this.db.getFirstAsync<any>(
        `SELECT * FROM knowledge_entries WHERE id = ?`,
        id,
      );

      return this.mapRowToKnowledgeEntry(created);
    } catch (error) {
      console.error('[DB] createKnowledgeEntry failed:', error);
      throw error;
    }
  }

  async getKnowledgeEntries(type?: KnowledgeEntryType, limit: number = 30): Promise<KnowledgeEntry[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const rows = type
        ? await this.db.getAllAsync<any>(
            `SELECT * FROM knowledge_entries
             WHERE type = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            type,
            limit,
          )
        : await this.db.getAllAsync<any>(
            `SELECT * FROM knowledge_entries
             ORDER BY created_at DESC
             LIMIT ?`,
            limit,
          );

      return rows.map((row) => this.mapRowToKnowledgeEntry(row));
    } catch (error) {
      console.error('[DB] getKnowledgeEntries failed:', error);
      throw error;
    }
  }

  async updateKnowledgeEntrySyncStatus(
    entryId: string,
    syncStatus: KnowledgeSyncStatus,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const now = new Date().toISOString();
      await this.db.runAsync(
        `UPDATE knowledge_entries
         SET sync_status = ?, updated_at = ?
         WHERE id = ?`,
        syncStatus,
        now,
        entryId,
      );
    } catch (error) {
      console.error('[DB] updateKnowledgeEntrySyncStatus failed:', error);
      throw error;
    }
  }

  // ─── Badges ────────────────────────────────────────────────

  async initBadges(badges: Omit<Badge, 'isUnlocked' | 'unlockedAt'>[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      for (const badge of badges) {
        await this.db.runAsync(
          `INSERT OR IGNORE INTO badges (id, name, emoji, description, condition)
           VALUES (?, ?, ?, ?, ?)`,
          badge.id,
          badge.name,
          badge.emoji,
          badge.description,
          badge.condition,
        );
      }
    } catch (error) {
      console.error('[DB] initBadges failed:', error);
      throw error;
    }
  }

  async unlockBadge(badgeId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const now = new Date().toISOString();
      await this.db.runAsync(
        `UPDATE badges SET is_unlocked = 1, unlocked_at = ? WHERE id = ? AND is_unlocked = 0`,
        now,
        badgeId,
      );
    } catch (error) {
      console.error('[DB] unlockBadge failed:', error);
      throw error;
    }
  }

  async getAllBadges(): Promise<Badge[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const rows = await this.db.getAllAsync<any>(`SELECT * FROM badges`);
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        description: row.description,
        isUnlocked: row.is_unlocked === 1,
        unlockedAt: row.unlocked_at || undefined,
        condition: row.condition,
      }));
    } catch (error) {
      console.error('[DB] getAllBadges failed:', error);
      throw error;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────

  private mapRowToTask(row: any, steps: any[]): Task {
    return {
      id: row.id,
      title: row.title,
      category: row.category,
      status: row.status,
      steps: steps.map((s) => ({
        id: s.id,
        task_id: s.task_id,
        title: s.title,
        estimatedMinutes: s.estimated_minutes,
        isCompleted: s.is_completed === 1,
        completedAt: s.completed_at || undefined,
        order: s.order,
      })),
      currentStepIndex: row.current_step_index,
      estimatedMinutes: row.estimated_minutes,
      minimalStep: row.minimal_step,
      createdAt: row.created_at,
      completedAt: row.completed_at || undefined,
      xpEarned: row.xp_earned,
    };
  }

  private mapRowToKnowledgeEntry(row: any): KnowledgeEntry {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      content: row.content,
      relatedTaskId: row.related_task_id || undefined,
      syncStatus: row.sync_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export const database = new Database();
