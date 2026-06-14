import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const PORT = Number(process.env.AI_BACKEND_PORT || process.env.PORT || 8788);
const ALLOWED_ORIGIN = process.env.AI_BACKEND_ALLOWED_ORIGIN || '*';
const GLM_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const GLM_MODEL = process.env.GLM_MODEL || 'glm-4-plus';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `你是一个目标规划助手。用户会描述一个想完成的目标，你需要将其拆解成可执行的计划，并加入过程测验和成果测验。

请严格按照以下 JSON 格式返回（不要包含任何其他文字或 markdown 标记）：
{
  "category": "work/study/creative",
  "totalMinutes": 数字（总预估分钟数）,
  "steps": [
    {"title": "步骤名称", "estimatedMinutes": 数字, "output": "这一步的可见产出"}
  ],
  "minimalStep": "最小一步的描述（如果用户现在只能做一步，应该做什么）",
  "checkpoints": [
    {
      "title": "过程测验名称",
      "prompt": "用户做到中途时需要回答/提交的小测验",
      "passCriteria": ["通过标准1", "通过标准2"]
    }
  ],
  "finalAssessment": {
    "title": "成果测验名称",
    "format": "quiz/submission/reflection/practical_task",
    "prompt": "用户最终需要提交、回答或完成的验收任务",
    "passCriteria": ["通过标准1", "通过标准2", "通过标准3"]
  }
}

规则：
- 步骤数量 3-6 个
- 每个步骤不超过 60 分钟
- 每个步骤必须有明确 output，说明用户做完这一步能看到什么产出
- checkpoints 数量 1-2 个，放在中途检查用户是否真的推进
- finalAssessment 必须能证明目标是否真的完成，不要只写“复盘一下”
- totalMinutes 是所有步骤 estimatedMinutes 之和
- category 根据任务性质判断：work=工作/效率, study=学习/考试, creative=创作/设计
- minimalStep 要具体可执行，不超过 20 字
- 所有文本使用中文`;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, statusCode, payload) {
  setCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolveBody(raw));
    req.on('error', reject);
  });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI 请求超时，请检查网络后重试')), ms),
    ),
  ]);
}

function getProvider(requestedModel) {
  const provider = requestedModel || process.env.AI_PROVIDER || process.env.EXPO_PUBLIC_AI_PROVIDER || 'glm';
  return provider === 'claude' ? 'claude' : 'glm';
}

function getApiKey(provider) {
  if (provider === 'claude') {
    return process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY || '';
  }

  return process.env.GLM_API_KEY || process.env.AI_API_KEY || process.env.EXPO_PUBLIC_AI_API_KEY || '';
}

function buildUserPrompt(input) {
  return `用户想完成一个目标，请帮我拆解成可执行计划，并设计过程测验和成果测验。\n目标描述：${input}`;
}

function extractJSON(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

function validateAnalysis(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.steps)) {
    throw new Error('AI 返回的数据格式不正确');
  }

  const validCategories = ['work', 'study', 'creative'];
  const category = validCategories.includes(data.category) ? data.category : 'work';
  const steps = data.steps.map((step, index) => ({
    title: typeof step?.title === 'string' ? step.title : `步骤 ${index + 1}`,
    estimatedMinutes:
      typeof step?.estimatedMinutes === 'number' ? step.estimatedMinutes : 15,
    output: typeof step?.output === 'string' ? step.output : undefined,
  }));
  const totalMinutes =
    typeof data.totalMinutes === 'number'
      ? data.totalMinutes
      : steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
  const minimalStep =
    typeof data.minimalStep === 'string' ? data.minimalStep : steps[0]?.title ?? '开始第一步';

  const checkpoints = Array.isArray(data.checkpoints) && data.checkpoints.length > 0
    ? data.checkpoints.slice(0, 2).map((checkpoint, index) => ({
        title: typeof checkpoint?.title === 'string' ? checkpoint.title : `检查点 ${index + 1}`,
        prompt:
          typeof checkpoint?.prompt === 'string'
            ? checkpoint.prompt
            : '用一句话说明目前完成了什么，以及下一步要产出什么。',
        passCriteria:
          Array.isArray(checkpoint?.passCriteria) && checkpoint.passCriteria.length > 0
            ? checkpoint.passCriteria.filter((item) => typeof item === 'string')
            : ['回答具体', '能证明有实际产出'],
      }))
    : [
        {
          title: '中途检查',
          prompt: '用一句话说明目前完成了什么，以及下一步要产出什么。',
          passCriteria: ['回答具体', '能证明有实际产出'],
        },
      ];

  const assessment = data.finalAssessment && typeof data.finalAssessment === 'object'
    ? data.finalAssessment
    : {};
  const validFormats = ['quiz', 'submission', 'reflection', 'practical_task'];
  const finalAssessment = {
    title: typeof assessment.title === 'string' ? assessment.title : '成果验收',
    format: validFormats.includes(assessment.format) ? assessment.format : 'submission',
    prompt:
      typeof assessment.prompt === 'string'
        ? assessment.prompt
        : '提交今天完成的最终产出，并用 3 点说明它是否达到目标。',
    passCriteria:
      Array.isArray(assessment.passCriteria) && assessment.passCriteria.length > 0
        ? assessment.passCriteria.filter((item) => typeof item === 'string')
        : ['有明确产出', '覆盖主要步骤', '能指出下一步改进'],
  };

  return { category, totalMinutes, steps, minimalStep, checkpoints, finalAssessment };
}

async function callGLM(apiKey, userMessage) {
  const response = await withTimeout(
    fetch(GLM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    }),
    TIMEOUT_MS,
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[ai-backend] GLM error:', response.status, errorBody);
    if (response.status === 401) throw new Error('GLM API Key 无效');
    if (response.status === 429) throw new Error('GLM API 调用频率超限，请稍后重试');
    throw new Error(`GLM 服务异常 (${response.status})`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('GLM 返回内容为空');
  return content;
}

async function callClaude(apiKey, userMessage) {
  const response = await withTimeout(
    fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    }),
    TIMEOUT_MS,
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[ai-backend] Claude error:', response.status, errorBody);
    if (response.status === 401) throw new Error('Claude API Key 无效');
    if (response.status === 429) throw new Error('Claude API 调用频率超限，请稍后重试');
    throw new Error(`Claude 服务异常 (${response.status})`);
  }

  const data = await response.json();
  const textBlock = data?.content?.[0];
  if (!textBlock || textBlock.type !== 'text') throw new Error('Claude 返回内容为空');
  return textBlock.text;
}

async function handleAnalyze(req, res) {
  let body;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw || '{}');
  } catch {
    sendJson(res, 400, { message: 'Invalid JSON body' });
    return;
  }

  const input = typeof body.input === 'string' ? body.input.trim() : '';
  const provider = getProvider(body.model);
  const apiKey = getApiKey(provider);

  if (!input) {
    sendJson(res, 400, { message: '请输入任务描述' });
    return;
  }

  if (!apiKey) {
    sendJson(res, 500, {
      message: provider === 'glm' ? 'Server missing GLM API key' : 'Server missing Claude API key',
    });
    return;
  }

  try {
    const userMessage = buildUserPrompt(input);
    const responseText =
      provider === 'claude'
        ? await callClaude(apiKey, userMessage)
        : await callGLM(apiKey, userMessage);
    const analysis = validateAnalysis(JSON.parse(extractJSON(responseText)));
    sendJson(res, 200, { analysis, model: provider });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 分析失败，请重试';
    sendJson(res, 500, { message });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    const provider = getProvider();
    sendJson(res, 200, {
      ok: true,
      service: 'ignite-ai-backend',
      provider,
      ready: Boolean(getApiKey(provider)),
      port: PORT,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/analyze-task') {
    await handleAnalyze(req, res);
    return;
  }

  sendJson(res, 404, { message: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`[ai-backend] listening on http://localhost:${PORT}`);
  console.log('[ai-backend] POST /api/ai/analyze-task');
  console.log('[ai-backend] GET  /health');
});
