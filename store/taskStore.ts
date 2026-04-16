// Task store using zustand
import { create } from 'zustand';

interface TaskState {
  tasks: any[];
  // TODO: add actions
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
}));
