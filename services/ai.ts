// AI 任务拆解服务 — 通过本地后端代理调用 GLM / Claude

// ─── Types ──────────────────────────────────────────────────

export interface AIStep {
  title: string;
  estimatedMinutes: number;
  output?: string;
}

export interface AICheckpoint {
  title: string;
  prompt: string;
  passCriteria: string[];
}

export interface AIFinalAssessment {
  title: string;
  format: 'quiz' | 'submission' | 'reflection' | 'practical_task';
  prompt: string;
  passCriteria: string[];
}

export interface AIAnalysis {
  category: 'work' | 'study' | 'creative';
  totalMinutes: number;
  steps: AIStep[];
  minimalStep: string;
  checkpoints: AICheckpoint[];
  finalAssessment: AIFinalAssessment;
  source?: 'ai' | 'fallback';
}

// ─── Constants ──────────────────────────────────────────────

const TIMEOUT_MS = 30_000;
const DEFAULT_BACKEND_URL = 'http://localhost:8788';

// ─── Helpers ────────────────────────────────────────────────

function withTimeout(promise: Promise<Response>, ms: number): Promise<Response> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI 请求超时，请检查网络后重试')), ms),
    ),
  ]);
}

function getBackendUrl(): string {
  return (process.env.EXPO_PUBLIC_AI_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/$/, '');
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
      output: typeof step.output === 'string' ? step.output : undefined,
    };
  });

  const totalMinutes =
    typeof obj.totalMinutes === 'number'
      ? obj.totalMinutes
      : steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const minimalStep =
    typeof obj.minimalStep === 'string' ? obj.minimalStep : steps[0]?.title ?? '开始第一步';

  const checkpoints = normalizeCheckpoints(obj.checkpoints, steps);
  const finalAssessment = normalizeFinalAssessment(obj.finalAssessment, steps);

  return { category, totalMinutes, steps, minimalStep, checkpoints, finalAssessment, source: 'ai' };
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return items.length > 0 ? items : fallback;
}

function normalizeCheckpoints(value: unknown, steps: AIStep[]): AICheckpoint[] {
  const fallback: AICheckpoint = {
    title: '中途检查',
    prompt: '用一句话说明目前完成了什么，以及下一步要产出什么。',
    passCriteria: ['能说清当前进度', '能指出下一步具体动作'],
  };

  if (!Array.isArray(value)) return [fallback];

  const checkpoints = value
    .map((item, index): AICheckpoint | null => {
      const checkpoint = item as Record<string, unknown>;
      const title = typeof checkpoint.title === 'string' ? checkpoint.title : `检查点 ${index + 1}`;
      const prompt =
        typeof checkpoint.prompt === 'string'
          ? checkpoint.prompt
          : `完成前 ${Math.max(1, Math.ceil(steps.length / 2))} 步后，说明你已经得到的结果。`;
      return {
        title,
        prompt,
        passCriteria: normalizeStringArray(checkpoint.passCriteria, ['回答具体', '能证明有实际产出']),
      };
    })
    .filter((item): item is AICheckpoint => Boolean(item));

  return checkpoints.length > 0 ? checkpoints.slice(0, 2) : [fallback];
}

function normalizeFinalAssessment(value: unknown, steps: AIStep[]): AIFinalAssessment {
  const fallback: AIFinalAssessment = {
    title: '成果验收',
    format: 'submission',
    prompt: '提交今天完成的最终产出，并用 3 点说明它是否达到目标。',
    passCriteria: ['有明确产出', '覆盖主要步骤', '能指出下一步改进'],
  };

  if (!value || typeof value !== 'object') return fallback;
  const assessment = value as Record<string, unknown>;
  const validFormats = ['quiz', 'submission', 'reflection', 'practical_task'];
  const format = validFormats.includes(assessment.format as string)
    ? (assessment.format as AIFinalAssessment['format'])
    : fallback.format;

  return {
    title: typeof assessment.title === 'string' ? assessment.title : fallback.title,
    format,
    prompt:
      typeof assessment.prompt === 'string'
        ? assessment.prompt
        : `根据 ${steps.map((step) => step.title).join('、')} 的结果，提交一个可检查的最终成果。`,
    passCriteria: normalizeStringArray(assessment.passCriteria, fallback.passCriteria),
  };
}

function inferCategory(input: string): AIAnalysis['category'] {
  const normalized = input.toLowerCase();
  if (/(写|画|拍|剪|设计|创作|视频|文章|海报|故事|脚本)/.test(normalized)) {
    return 'creative';
  }
  if (/(学|读|背|练|课程|考试|论文|研究|复习|教程)/.test(normalized)) {
    return 'study';
  }
  return 'work';
}

function buildFallbackAnalysis(input: string): AIAnalysis {
  const title = input.trim();
  const steps: AIStep[] = [
    { title: '明确完成标准和交付结果', estimatedMinutes: 10, output: '一条完成标准' },
    { title: `开始处理：${title}`, estimatedMinutes: 25, output: '第一版草稿或清单' },
    { title: '检查遗漏并补齐关键细节', estimatedMinutes: 15, output: '补充后的关键点' },
    { title: '整理输出，确认可以结束', estimatedMinutes: 10, output: '可提交的最终版本' },
  ];

  return {
    category: inferCategory(title),
    totalMinutes: steps.reduce((sum, step) => sum + step.estimatedMinutes, 0),
    steps,
    minimalStep: '先写下这个目标的完成标准',
    checkpoints: [
      {
        title: '中途测验',
        prompt: '用 3 句话说明：你现在的核心结论、证据和下一步动作分别是什么？',
        passCriteria: ['结论具体', '至少有一个证据', '下一步动作可以马上执行'],
      },
    ],
    finalAssessment: {
      title: '成果测验',
      format: 'submission',
      prompt: '提交最终产出，并按“完成度、可用性、下一步”各写 1 条自评。',
      passCriteria: ['有可查看的最终产出', '能说明完成标准是否达成', '能列出一个后续改进点'],
    },
    source: 'fallback',
  };
}

// ─── AIService ──────────────────────────────────────────────

class AIService {
  /**
   * 通过后端代理调用 AI 拆解任务
   * @param input 用户的任务描述
   * @param model 使用的模型
   */
  async analyzeTask(
    input: string,
    model: 'claude' | 'glm',
    _apiKey?: string,
  ): Promise<AIAnalysis> {
    if (!input.trim()) {
      throw new Error('请输入任务描述');
    }

    const normalizedInput = input.trim();

    try {
      const response = await withTimeout(
        fetch(`${getBackendUrl()}/api/ai/analyze-task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: normalizedInput,
            model,
          }),
        }),
        TIMEOUT_MS,
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `AI 后端服务异常 (${response.status})`);
      }

      const data = await response.json();
      return validateAnalysis(data?.analysis);
    } catch (error) {
      console.warn('[AIService] Falling back to local task analysis:', error);
      return buildFallbackAnalysis(normalizedInput);
    }
  }
}

export const aiService = new AIService();
