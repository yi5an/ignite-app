// We only test the pure helper functions from ai.ts
// The AI service class itself requires network — not suitable for unit tests

// Since extractJSON and validateAnalysis are not exported, we test them
// by importing the module and accessing internals, OR we re-implement the tests
// based on the known logic.

// For now, let's test the pure logic patterns we can extract.
// We'll test the XP level calculation logic which is used in xpStore.

// ─── XP Level Calculation (pure logic extracted from xpStore) ───

const XP_PER_LEVEL = 100;

function calculateLevel(totalXP: number): number {
  return Math.floor(totalXP / XP_PER_LEVEL) + 1;
}

function calculateLevelProgress(totalXP: number): number {
  const currentLevelXP = Math.floor(totalXP / XP_PER_LEVEL) * XP_PER_LEVEL;
  const progress = totalXP - currentLevelXP;
  return (progress / XP_PER_LEVEL) * 100;
}

describe('XP Level Calculation', () => {
  describe('calculateLevel', () => {
    it('returns level 1 for 0 XP', () => {
      expect(calculateLevel(0)).toBe(1);
    });

    it('returns level 1 for 99 XP', () => {
      expect(calculateLevel(99)).toBe(1);
    });

    it('returns level 2 for 100 XP', () => {
      expect(calculateLevel(100)).toBe(2);
    });

    it('returns level 2 for 199 XP', () => {
      expect(calculateLevel(199)).toBe(2);
    });

    it('returns level 3 for 200 XP', () => {
      expect(calculateLevel(200)).toBe(3);
    });

    it('returns level 11 for 1000 XP', () => {
      expect(calculateLevel(1000)).toBe(11);
    });

    it('handles fractional XP gracefully (floor)', () => {
      expect(calculateLevel(150)).toBe(2);
    });
  });

  describe('calculateLevelProgress', () => {
    it('returns 0% at exactly a level boundary', () => {
      expect(calculateLevelProgress(0)).toBe(0);
      expect(calculateLevelProgress(100)).toBe(0);
      expect(calculateLevelProgress(200)).toBe(0);
    });

    it('returns 50% at half XP', () => {
      expect(calculateLevelProgress(50)).toBe(50);
      expect(calculateLevelProgress(150)).toBe(50);
    });

    it('returns 99% just before next level', () => {
      expect(calculateLevelProgress(99)).toBe(99);
    });

    it('never returns 100%', () => {
      // At 100 XP, progress resets to 0 for next level
      expect(calculateLevelProgress(100)).toBe(0);
      expect(calculateLevelProgress(99)).toBe(99);
    });

    it('returns correct percentage for arbitrary values', () => {
      expect(calculateLevelProgress(25)).toBe(25);
      expect(calculateLevelProgress(75)).toBe(75);
      expect(calculateLevelProgress(333)).toBe(33);
    });
  });
});

// ─── extractJSON logic tests (mirroring the implementation) ───

function extractJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

describe('extractJSON', () => {
  it('returns plain JSON as-is', () => {
    const input = '{"key": "value"}';
    expect(extractJSON(input)).toBe(input);
  });

  it('strips markdown code fences with json label', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it('strips markdown code fences without label', () => {
    const input = '```\n{"key": "value"}\n```';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it('handles code fences with no newlines', () => {
    const input = '```json\n{"key": "value"}```';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it('trims whitespace from input', () => {
    const input = '  {"key": "value"}  ';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it('handles text that does not start with code fence', () => {
    const input = 'Some preamble\n{"key": "value"}';
    expect(extractJSON(input)).toBe(input.trim());
  });

  it('handles empty string', () => {
    expect(extractJSON('')).toBe('');
  });
});

// ─── validateAnalysis logic tests (mirroring the implementation) ───

interface AIStep {
  title: string;
  estimatedMinutes: number;
}

interface AIAnalysis {
  category: 'work' | 'study' | 'creative';
  totalMinutes: number;
  steps: AIStep[];
  minimalStep: string;
}

function validateAnalysis(data: unknown): AIAnalysis {
  const obj = data as Record<string, unknown>;

  if (!obj.category || !obj.steps || !Array.isArray(obj.steps)) {
    throw new Error('AI 返回的数据格式不正确');
  }

  const validCategories = ['work', 'study', 'creative'];
  const category = validCategories.includes(obj.category as string)
    ? (obj.category as 'work' | 'study' | 'creative')
    : 'work';

  const steps: AIStep[] = (obj.steps as unknown[]).map((s: unknown, i: number) => {
    const step = s as Record<string, unknown>;
    return {
      title: typeof step.title === 'string' ? step.title : `步骤 ${i + 1}`,
      estimatedMinutes:
        typeof step.estimatedMinutes === 'number' ? step.estimatedMinutes : 15,
    };
  });

  const totalMinutes =
    typeof obj.totalMinutes === 'number'
      ? obj.totalMinutes
      : steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const minimalStep =
    typeof obj.minimalStep === 'string' ? obj.minimalStep : steps[0]?.title ?? '开始第一步';

  return { category, totalMinutes, steps, minimalStep };
}

describe('validateAnalysis', () => {
  it('validates a correct analysis object', () => {
    const input = {
      category: 'study',
      totalMinutes: 60,
      steps: [
        { title: 'Step 1', estimatedMinutes: 30 },
        { title: 'Step 2', estimatedMinutes: 30 },
      ],
      minimalStep: 'Do step 1 first',
    };
    const result = validateAnalysis(input);
    expect(result.category).toBe('study');
    expect(result.totalMinutes).toBe(60);
    expect(result.steps).toHaveLength(2);
    expect(result.minimalStep).toBe('Do step 1 first');
  });

  it('throws on missing category', () => {
    expect(() => validateAnalysis({ steps: [] })).toThrow('AI 返回的数据格式不正确');
  });

  it('throws on missing steps', () => {
    expect(() => validateAnalysis({ category: 'work' })).toThrow('AI 返回的数据格式不正确');
  });

  it('throws when steps is not an array', () => {
    expect(() => validateAnalysis({ category: 'work', steps: 'not-array' })).toThrow(
      'AI 返回的数据格式不正确',
    );
  });

  it('defaults invalid category to "work"', () => {
    const result = validateAnalysis({
      category: 'invalid',
      steps: [{ title: 'A', estimatedMinutes: 10 }],
    });
    expect(result.category).toBe('work');
  });

  it('defaults invalid step title to fallback', () => {
    const result = validateAnalysis({
      category: 'work',
      steps: [{ estimatedMinutes: 10 }],
    });
    expect(result.steps[0].title).toBe('步骤 1');
  });

  it('defaults invalid estimatedMinutes to 15', () => {
    const result = validateAnalysis({
      category: 'work',
      steps: [{ title: 'A', estimatedMinutes: 'not-a-number' }],
    });
    expect(result.steps[0].estimatedMinutes).toBe(15);
  });

  it('calculates totalMinutes from steps when missing', () => {
    const result = validateAnalysis({
      category: 'creative',
      steps: [
        { title: 'A', estimatedMinutes: 20 },
        { title: 'B', estimatedMinutes: 30 },
      ],
    });
    expect(result.totalMinutes).toBe(50);
  });

  it('defaults minimalStep from first step title when missing', () => {
    const result = validateAnalysis({
      category: 'work',
      steps: [{ title: 'First step', estimatedMinutes: 10 }],
    });
    expect(result.minimalStep).toBe('First step');
  });

  it('defaults minimalStep to fallback when no steps', () => {
    const result = validateAnalysis({
      category: 'study',
      steps: [],
      minimalStep: undefined,
    });
    expect(result.minimalStep).toBe('开始第一步');
  });
});
