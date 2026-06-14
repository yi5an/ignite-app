// Task store using zustand
import { create } from 'zustand';
import { Task, Step, TaskCategory } from '../types';
import { database } from '../services/database';
import { useXPStore } from './xpStore';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

async function recordProgress(stepCompleted: boolean, taskCompleted: boolean): Promise<void> {
  const stats = await database.getStats();
  await database.updateStats({
    completedSteps: stats.completedSteps + (stepCompleted ? 1 : 0),
    completedTasks: stats.completedTasks + (taskCompleted ? 1 : 0),
  });
}

interface TaskState {
  tasks: Task[];
  todayTasks: Task[];
  isLoading: boolean;

  // Actions
  loadTodayTasks: () => Promise<void>;
  loadAllTasks: () => Promise<void>;
  createTask: (
    title: string,
    category: TaskCategory,
    steps: Omit<Step, 'id' | 'task_id' | 'isCompleted' | 'completedAt'>[],
    minimalStep: string,
  ) => Promise<Task>;
  completeStep: (taskId: string, stepId: string) => Promise<void>;
  completeCurrentStep: (taskId: string) => Promise<void>;
  setTodayTasks: (taskIds: string[]) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addTaskToToday: (taskId: string) => Promise<void>;
  removeTaskFromToday: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  todayTasks: [],
  isLoading: false,

  loadTodayTasks: async () => {
    try {
      set({ isLoading: true });
      const todayTasks = await database.getTodayTasks();
      set({ todayTasks, isLoading: false });
    } catch (error) {
      console.error('[taskStore] loadTodayTasks failed:', error);
      set({ isLoading: false });
    }
  },

  loadAllTasks: async () => {
    try {
      set({ isLoading: true });
      const tasks = await database.getAllTasks();
      const todayTasks = tasks.filter((t) => t.status === 'today');
      set({ tasks, todayTasks, isLoading: false });
    } catch (error) {
      console.error('[taskStore] loadAllTasks failed:', error);
      set({ isLoading: false });
    }
  },

  createTask: async (title, category, steps, minimalStep) => {
    try {
      const now = new Date().toISOString();
      const totalMinutes = steps.reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0);

      const taskSteps: Step[] = steps.map((s, index) => ({
        id: generateId(),
        task_id: '', // will be set after task creation
        title: s.title,
        estimatedMinutes: s.estimatedMinutes,
        isCompleted: false,
        completedAt: undefined,
        order: s.order ?? index,
      }));

      const task = await database.createTask({
        title,
        category,
        status: 'backlog',
        steps: taskSteps,
        currentStepIndex: 0,
        estimatedMinutes: totalMinutes,
        minimalStep,
        createdAt: now,
        completedAt: undefined,
        xpEarned: 0,
      });

      // Update local state
      set((state) => ({
        tasks: [task, ...state.tasks],
      }));

      return task;
    } catch (error) {
      console.error('[taskStore] createTask failed:', error);
      throw error;
    }
  },

  completeStep: async (taskId, stepId) => {
    try {
      const taskBeforeUpdate = await database.getTask(taskId);
      const targetStep = taskBeforeUpdate?.steps.find((step) => step.id === stepId);
      if (!taskBeforeUpdate || !targetStep || targetStep.isCompleted) return;

      await database.completeStep(stepId);

      // Get updated task from DB
      const updatedTask = await database.getTask(taskId);
      if (!updatedTask) return;

      // Check if all steps are completed
      const allCompleted = updatedTask.steps.length > 0 && updatedTask.steps.every((s) => s.isCompleted);

      if (allCompleted) {
        const now = new Date().toISOString();
        // Calculate XP: 10 base + 5 per step
        const xpEarned = 10 + updatedTask.steps.length * 5;

        await database.updateTask({
          id: taskId,
          status: 'completed',
          completedAt: now,
          xpEarned,
        });

        await recordProgress(true, true);

        // Award XP for task completion
        await useXPStore.getState().addXP(xpEarned, 'task', taskId);
        await useXPStore.getState().updateStreak();
      } else {
        await recordProgress(true, false);
      }

      // Award XP for step completion
      await useXPStore.getState().addXP(20, 'task', taskId);

      // Reload the task to get latest state
      const finalTask = await database.getTask(taskId);
      if (finalTask) {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? finalTask : t)),
          todayTasks: state.todayTasks.map((t) => (t.id === taskId ? finalTask : t)),
        }));
      }
    } catch (error) {
      console.error('[taskStore] completeStep failed:', error);
    }
  },

  completeCurrentStep: async (taskId) => {
    try {
      const task = await database.getTask(taskId);
      if (!task) return;

      const currentIndex = task.currentStepIndex;
      if (currentIndex >= task.steps.length) return;

      const currentStep = task.steps[currentIndex];
      if (currentStep.isCompleted) return;

      // Complete the current step
      await database.completeStep(currentStep.id);

      // Move to next step
      const nextIndex = currentIndex + 1;
      const allCompleted = nextIndex >= task.steps.length;

      const updates: Partial<Task> & { id: string } = {
        id: taskId,
        currentStepIndex: nextIndex,
      };

      if (allCompleted) {
        const now = new Date().toISOString();
        const xpEarned = 10 + task.steps.length * 5;
        updates.status = 'completed';
        updates.completedAt = now;
        updates.xpEarned = xpEarned;

        await recordProgress(true, true);

        // Award XP for task completion
        await useXPStore.getState().addXP(xpEarned, 'task', taskId);
        await useXPStore.getState().updateStreak();
      } else {
        await recordProgress(true, false);
      }

      // Award XP for step completion
      await useXPStore.getState().addXP(20, 'task', taskId);

      await database.updateTask(updates);

      // Reload the task
      const finalTask = await database.getTask(taskId);
      if (finalTask) {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? finalTask : t)),
          todayTasks: state.todayTasks.map((t) => (t.id === taskId ? finalTask : t)),
        }));
      }
    } catch (error) {
      console.error('[taskStore] completeCurrentStep failed:', error);
    }
  },

  setTodayTasks: async (taskIds) => {
    try {
      await database.setTodayTasks(taskIds);

      // Reload today tasks
      const todayTasks = await database.getTodayTasks();

      // Update local state: remove old today tasks from today, add new ones
      set((state) => {
        const todayIds = new Set(todayTasks.map((t) => t.id));
        const updatedTasks = state.tasks.map((t) => {
          if (todayIds.has(t.id)) {
            return { ...t, status: 'today' as const };
          }
          if (t.status === 'today' && !todayIds.has(t.id)) {
            return { ...t, status: 'backlog' as const };
          }
          return t;
        });
        return { tasks: updatedTasks, todayTasks };
      });
    } catch (error) {
      console.error('[taskStore] setTodayTasks failed:', error);
    }
  },

  deleteTask: async (taskId) => {
    try {
      await database.deleteTask(taskId);

      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== taskId),
        todayTasks: state.todayTasks.filter((t) => t.id !== taskId),
      }));
    } catch (error) {
      console.error('[taskStore] deleteTask failed:', error);
    }
  },

  addTaskToToday: async (taskId) => {
    try {
      const { todayTasks } = get();
      if (todayTasks.length >= 3) {
        console.warn('[taskStore] Cannot add more than 3 tasks to today');
        return;
      }

      await database.updateTask({ id: taskId, status: 'today' });

      const updatedTask = await database.getTask(taskId);
      if (updatedTask) {
        set((state) => ({
          todayTasks: [...state.todayTasks, updatedTask],
          tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
        }));
      }
    } catch (error) {
      console.error('[taskStore] addTaskToToday failed:', error);
    }
  },

  removeTaskFromToday: async (taskId) => {
    try {
      await database.updateTask({ id: taskId, status: 'backlog' });

      const updatedTask = await database.getTask(taskId);
      if (updatedTask) {
        set((state) => ({
          todayTasks: state.todayTasks.filter((t) => t.id !== taskId),
          tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
        }));
      }
    } catch (error) {
      console.error('[taskStore] removeTaskFromToday failed:', error);
    }
  },

  updateTaskStatus: async (taskId, status) => {
    try {
      const updates: Partial<Task> & { id: string } = { id: taskId, status };

      if (status === 'completed') {
        updates.completedAt = new Date().toISOString();
      }

      await database.updateTask(updates);

      const updatedTask = await database.getTask(taskId);
      if (updatedTask) {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? updatedTask : t)),
          todayTasks:
            status === 'completed'
              ? state.todayTasks.filter((t) => t.id !== taskId)
              : state.todayTasks.map((t) => (t.id === taskId ? updatedTask : t)),
        }));
      }
    } catch (error) {
      console.error('[taskStore] updateTaskStatus failed:', error);
    }
  },
}));
