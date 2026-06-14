import type { TaskCategory } from '../types';

export const colors = {
  bg: '#0A0A0F',
  surface: '#111118',
  card: '#18181F',
  card2: '#1E1E28',
  border: '#2A2A38',
  border2: '#333345',
  text: '#E8E8F0',
  text2: '#8888A0',
  text3: '#55556A',
  blue: '#4F8EF7',
  blue2: '#3B7BF5',
  green: '#34D399',
  green2: '#10B981',
  amber: '#FBBF24',
  purple: '#A78BFA',
  purple2: '#7C3AED',
  red: '#F87171',
};

export const fonts = {
  heading: 'Syne',
  headingExtra: 'Syne-ExtraBold',
  body: 'DM Sans',
  mono: 'DM Mono',
  monoMedium: 'DM Mono Medium',
};

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 99,
};

export const glow = {
  blue: 'rgba(79,142,247,0.18)',
  green: 'rgba(52,211,153,0.15)',
  amber: 'rgba(251,191,36,0.15)',
  purple: 'rgba(167,139,250,0.16)',
};

export const categoryTheme: Record<
  TaskCategory,
  {
    label: string;
    shortLabel: string;
    color: string;
    color2: string;
    bg: string;
    border: string;
  }
> = {
  work: {
    label: '工作',
    shortLabel: 'WORK',
    color: colors.blue,
    color2: colors.blue2,
    bg: 'rgba(79,142,247,0.15)',
    border: 'rgba(79,142,247,0.3)',
  },
  study: {
    label: '学习',
    shortLabel: 'STUDY',
    color: colors.green,
    color2: colors.green2,
    bg: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.25)',
  },
  creative: {
    label: '创意',
    shortLabel: 'CREATE',
    color: colors.purple,
    color2: colors.purple2,
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.25)',
  },
};
