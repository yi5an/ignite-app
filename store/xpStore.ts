// XP store using zustand
import { create } from 'zustand';

interface XPState {
  totalXP: number;
  level: number;
  // TODO: add actions
}

export const useXPStore = create<XPState>((set) => ({
  totalXP: 0,
  level: 1,
}));
