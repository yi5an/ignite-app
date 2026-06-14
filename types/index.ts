// ─── Core Types ──────────────────────────────────────────────

export type TaskCategory = 'work' | 'study' | 'creative';
export type TaskStatus = 'today' | 'backlog' | 'completed' | 'archived';

export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  status: TaskStatus;
  steps: Step[];
  currentStepIndex: number;
  estimatedMinutes: number;
  minimalStep: string; // 最小一步描述
  createdAt: string; // ISO date
  completedAt?: string;
  xpEarned: number;
}

export interface Step {
  id: string;
  task_id: string;
  title: string;
  estimatedMinutes: number;
  isCompleted: boolean;
  completedAt?: string;
  order: number;
}

export interface XPRecord {
  id: string;
  amount: number;
  source: 'task' | 'pomodoro' | 'practice' | 'exam' | 'streak';
  taskId?: string;
  createdAt: string;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  condition: string;
}

export interface Milestone {
  id: string;
  name: string;
  current: number;
  target: number;
  unit: string;
  reward: string;
}

export interface UserStats {
  totalXP: number;
  level: number;
  streakDays: number;
  completedTasks: number;
  completedSteps: number;
  lastActiveDate: string;
}

export interface AppSettings {
  pomodoroDuration: number; // 分钟，默认25
  breakDuration: number; // 分钟，默认5
  aiModel: 'claude' | 'glm';
  apiKey: string;
  dailyReminderTime: string; // HH:mm
  isDarkMode: boolean;
}

export type SyncProvider = 'none' | 'notion' | 'evernote' | 'markdown';
export type SyncMode = 'instant' | 'daily';
export type SyncItem = 'plans' | 'notes' | 'practice' | 'summaries';
export type KnowledgeEntryType = SyncItem;
export type KnowledgeSyncStatus = 'local' | 'queued' | 'synced';

export interface SyncSettings {
  enabled: boolean;
  provider: SyncProvider;
  mode: SyncMode;
  syncPlans: boolean;
  syncNotes: boolean;
  syncPractice: boolean;
  syncSummaries: boolean;
  notionDatabaseId: string;
  notionDataSourceId: string;
  notionWorkspaceName: string;
  notionOAuthClientId: string;
  notionOAuthExchangeUrl: string;
  evernoteNotebook: string;
  exportFolder: string;
  lastSyncedAt?: string;
  lastExportPath?: string;
}

export interface KnowledgeEntry {
  id: string;
  type: KnowledgeEntryType;
  title: string;
  content: string;
  relatedTaskId?: string;
  syncStatus: KnowledgeSyncStatus;
  createdAt: string;
  updatedAt: string;
}
