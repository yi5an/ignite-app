import { checkBadgeUnlocks, BADGE_DEFINITIONS, MILESTONE_DEFINITIONS } from '../constants/xp';

describe('checkBadgeUnlocks', () => {
  it('returns empty array when no conditions are met', () => {
    const result = checkBadgeUnlocks({
      streakDays: 0,
      completedTasks: 0,
      completedSteps: 0,
      totalXP: 0,
    });
    expect(result).toEqual([]);
  });

  it('unlocks streak_3 when streakDays >= 3', () => {
    const result = checkBadgeUnlocks({
      streakDays: 3,
      completedTasks: 0,
      completedSteps: 0,
      totalXP: 0,
    });
    expect(result).toContain('streak_3');
  });

  it('unlocks both streak_3 and streak_7 when streakDays >= 7', () => {
    const result = checkBadgeUnlocks({
      streakDays: 7,
      completedTasks: 0,
      completedSteps: 0,
      totalXP: 0,
    });
    expect(result).toContain('streak_3');
    expect(result).toContain('streak_7');
  });

  it('unlocks streak_30 when streakDays >= 30', () => {
    const result = checkBadgeUnlocks({
      streakDays: 30,
      completedTasks: 0,
      completedSteps: 0,
      totalXP: 0,
    });
    expect(result).toContain('streak_3');
    expect(result).toContain('streak_7');
    expect(result).toContain('streak_30');
  });

  it('unlocks first_creative when completedTasks >= 1', () => {
    const result = checkBadgeUnlocks({
      streakDays: 0,
      completedTasks: 1,
      completedSteps: 0,
      totalXP: 0,
    });
    expect(result).toContain('first_creative');
  });

  it('unlocks steps_20, steps_50, steps_100 at appropriate thresholds', () => {
    // 20 steps: only steps_20
    const r20 = checkBadgeUnlocks({ streakDays: 0, completedTasks: 0, completedSteps: 20, totalXP: 0 });
    expect(r20).toContain('steps_20');
    expect(r20).not.toContain('steps_50');

    // 50 steps: steps_20 + steps_50
    const r50 = checkBadgeUnlocks({ streakDays: 0, completedTasks: 0, completedSteps: 50, totalXP: 0 });
    expect(r50).toContain('steps_20');
    expect(r50).toContain('steps_50');
    expect(r50).not.toContain('steps_100');

    // 100 steps: all three
    const r100 = checkBadgeUnlocks({ streakDays: 0, completedTasks: 0, completedSteps: 100, totalXP: 0 });
    expect(r100).toContain('steps_20');
    expect(r100).toContain('steps_50');
    expect(r100).toContain('steps_100');
  });

  it('unlocks tasks_10 and monthly_15 at appropriate thresholds', () => {
    const r10 = checkBadgeUnlocks({ streakDays: 0, completedTasks: 10, completedSteps: 0, totalXP: 0 });
    expect(r10).toContain('tasks_10');
    expect(r10).not.toContain('monthly_15');

    const r15 = checkBadgeUnlocks({ streakDays: 0, completedTasks: 15, completedSteps: 0, totalXP: 0 });
    expect(r15).toContain('tasks_10');
    expect(r15).toContain('monthly_15');
  });

  it('unlocks xp_500 and xp_1000 at appropriate thresholds', () => {
    const r500 = checkBadgeUnlocks({ streakDays: 0, completedTasks: 0, completedSteps: 0, totalXP: 500 });
    expect(r500).toContain('xp_500');
    expect(r500).not.toContain('xp_1000');

    const r1000 = checkBadgeUnlocks({ streakDays: 0, completedTasks: 0, completedSteps: 0, totalXP: 1000 });
    expect(r1000).toContain('xp_500');
    expect(r1000).toContain('xp_1000');
  });

  it('unlocks all conditions when everything is maxed', () => {
    const result = checkBadgeUnlocks({
      streakDays: 30,
      completedTasks: 15,
      completedSteps: 100,
      totalXP: 1000,
    });
    // 11 conditions total: 3 streak + first_creative + 3 steps + 2 tasks + 2 xp
    expect(result).toHaveLength(11);
    expect(result).toEqual([
      'streak_3', 'streak_7', 'streak_30',
      'first_creative',
      'steps_20', 'steps_50', 'steps_100',
      'tasks_10', 'monthly_15',
      'xp_500', 'xp_1000',
    ]);
  });

  it('boundary: streak_2 does NOT unlock streak_3', () => {
    const result = checkBadgeUnlocks({ streakDays: 2, completedTasks: 0, completedSteps: 0, totalXP: 0 });
    expect(result).not.toContain('streak_3');
  });

  it('boundary: completedSteps=19 does NOT unlock steps_20', () => {
    const result = checkBadgeUnlocks({ streakDays: 0, completedTasks: 0, completedSteps: 19, totalXP: 0 });
    expect(result).not.toContain('steps_20');
  });
});

describe('BADGE_DEFINITIONS', () => {
  it('has at least one badge', () => {
    expect(BADGE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('each badge has required fields', () => {
    for (const badge of BADGE_DEFINITIONS) {
      expect(badge).toHaveProperty('id');
      expect(badge).toHaveProperty('name');
      expect(badge).toHaveProperty('emoji');
      expect(badge).toHaveProperty('description');
      expect(badge).toHaveProperty('isUnlocked');
      expect(typeof badge.isUnlocked).toBe('boolean');
      expect(badge).toHaveProperty('condition');
      expect(typeof badge.condition).toBe('string');
    }
  });

  it('badge ids are unique', () => {
    const ids = BADGE_DEFINITIONS.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('MILESTONE_DEFINITIONS', () => {
  it('has at least one milestone', () => {
    expect(MILESTONE_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it('each milestone has required fields', () => {
    for (const m of MILESTONE_DEFINITIONS) {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('name');
      expect(m).toHaveProperty('target');
      expect(typeof m.target).toBe('number');
      expect(m).toHaveProperty('unit');
      expect(m).toHaveProperty('reward');
    }
  });

  it('milestone ids are unique', () => {
    const ids = MILESTONE_DEFINITIONS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
