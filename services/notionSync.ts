import { KnowledgeEntry, SyncSettings, Task } from '../types';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2026-03-11';

export interface NotionSyncPreview {
  title: string;
  sections: Array<{
    heading: string;
    lines: string[];
  }>;
}

export interface DailyKnowledgePayload {
  tasks: Task[];
  quickNotes: string[];
  practiceSummary: string[];
  conclusionLines: string[];
}

interface NotionDatabaseProperty {
  id: string;
  type: string;
  name?: string;
}

interface NotionDataSourceRef {
  id: string;
  name?: string;
}

interface NotionDatabaseResponse {
  id: string;
  title?: Array<{
    plain_text?: string;
  }>;
  data_sources?: NotionDataSourceRef[];
  properties: Record<string, NotionDatabaseProperty>;
  url?: string;
}

interface NotionCreateDatabaseResponse {
  id: string;
  title?: Array<{
    plain_text?: string;
  }>;
  data_sources?: NotionDataSourceRef[];
  url?: string;
}

export interface NotionDatabaseInfo {
  id: string;
  title: string;
  titlePropertyName: string;
  dataSourceId: string;
  url?: string;
}

export interface NotionSyncResult {
  synced: Array<{
    entryId: string;
    pageId: string;
    pageUrl?: string;
  }>;
  failed: Array<{
    entryId: string;
    message: string;
  }>;
}

function getNotionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

async function notionRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers: {
      ...getNotionHeaders(token),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Notion 请求失败 (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.message) {
        message = payload.message;
      }
    } catch {
      // Ignore JSON parse issues for non-JSON errors.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function normalizeNotionId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const fromUrlMatch = trimmed.match(/([0-9a-fA-F]{32})(?:\?|$)/);
  const raw = (fromUrlMatch?.[1] || trimmed).replace(/[^0-9a-fA-F]/g, '');

  if (raw.length !== 32) {
    return trimmed;
  }

  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function getDatabaseTitle(parts?: Array<{ plain_text?: string }>): string {
  const title = parts?.map((part) => part.plain_text || '').join('').trim();
  return title || 'Untitled Database';
}

function getTitlePropertyName(properties: Record<string, NotionDatabaseProperty>): string {
  const titleProperty = Object.entries(properties).find(([, value]) => value.type === 'title');
  if (!titleProperty) {
    throw new Error('未找到 Notion 数据库的标题列，请确认数据库结构正常。');
  }
  return titleProperty[0];
}

function getPrimaryDataSourceId(dataSources?: NotionDataSourceRef[]): string {
  const first = dataSources?.[0]?.id;
  if (!first) {
    throw new Error('未找到 Notion 数据源，请确认数据库结构正常。');
  }
  return first;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function formatEntryType(type: KnowledgeEntry['type']): string {
  if (type === 'plans') return '计划';
  if (type === 'notes') return '笔记';
  if (type === 'practice') return '习题';
  return '总结';
}

function getEntryEmoji(type: KnowledgeEntry['type']): string {
  if (type === 'plans') return '🗂️';
  if (type === 'notes') return '✍️';
  if (type === 'practice') return '🧩';
  return '✨';
}

function buildKnowledgeEntryBlocks(entry: KnowledgeEntry) {
  const contentLines = (entry.content.trim() || '暂无内容')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  return [
    {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: `类型：${formatEntryType(entry.type)}  ·  创建时间：${new Date(entry.createdAt).toLocaleString('zh-CN')}`,
            },
          },
        ],
        icon: {
          type: 'emoji',
          emoji: getEntryEmoji(entry.type),
        },
        color: 'gray_background',
      },
    },
    ...contentLines.map((line) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: line },
          },
        ],
      },
    })),
  ];
}

export function buildNotionDailyPreview(
  payload: DailyKnowledgePayload,
  settings: SyncSettings,
): NotionSyncPreview {
  const selectedSections = [
    settings.syncPlans
      ? {
          heading: '今天的计划',
          lines:
            payload.tasks.length > 0
              ? payload.tasks.map((task) => `- ${task.title}`)
              : ['- 暂无计划'],
        }
      : null,
    settings.syncNotes
      ? {
          heading: '随手笔记',
          lines: payload.quickNotes.length > 0 ? payload.quickNotes : ['- 暂无笔记'],
        }
      : null,
    settings.syncPractice
      ? {
          heading: '习题记录',
          lines: payload.practiceSummary.length > 0 ? payload.practiceSummary : ['- 暂无习题记录'],
        }
      : null,
    settings.syncSummaries
      ? {
          heading: '总结',
          lines: payload.conclusionLines.length > 0 ? payload.conclusionLines : ['- 暂无总结'],
        }
      : null,
  ].filter(Boolean) as NotionSyncPreview['sections'];

  return {
    title: `Ignite / ${new Date().toISOString().slice(0, 10)} / 今日记录`,
    sections: selectedSections,
  };
}

export async function verifyNotionDatabase(
  token: string,
  databaseInput: string,
): Promise<NotionDatabaseInfo> {
  if (!token.trim()) {
    throw new Error('请先填写 Notion Integration Token');
  }

  const databaseId = normalizeNotionId(databaseInput);
  if (!databaseId) {
    throw new Error('请先填写 Notion 数据库 ID 或数据库页面 URL');
  }

  const response = await notionRequest<NotionDatabaseResponse>(
    `/databases/${databaseId}`,
    token,
    { method: 'GET' },
  );

  return {
    id: response.id,
    title: getDatabaseTitle(response.title),
    titlePropertyName: getTitlePropertyName(response.properties),
    dataSourceId: getPrimaryDataSourceId(response.data_sources),
    url: response.url,
  };
}

export async function createIgniteWorkspaceDatabase(
  token: string,
): Promise<NotionDatabaseInfo> {
  const response = await notionRequest<NotionCreateDatabaseResponse>(
    '/databases',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        parent: {
          type: 'workspace',
          workspace: true,
        },
        title: [
          {
            type: 'text',
            text: {
              content: 'Ignite',
            },
          },
        ],
        description: [
          {
            type: 'text',
            text: {
              content: 'Ignite 自动创建的计划、笔记、习题与总结收集库',
            },
          },
        ],
        is_inline: false,
        initial_data_source: {
          properties: {
            Name: { title: {} },
            Type: {
              select: {
                options: [
                  { name: '计划', color: 'blue' },
                  { name: '笔记', color: 'green' },
                  { name: '习题', color: 'yellow' },
                  { name: '总结', color: 'purple' },
                ],
              },
            },
          },
        },
      }),
    },
  );

  return {
    id: response.id,
    title: getDatabaseTitle(response.title) || 'Ignite',
    titlePropertyName: 'Name',
    dataSourceId: getPrimaryDataSourceId(response.data_sources),
    url: response.url,
  };
}

export async function ensureIgniteWorkspaceDatabase(params: {
  token: string;
  databaseId?: string;
}): Promise<NotionDatabaseInfo> {
  if (params.databaseId) {
    return verifyNotionDatabase(params.token, params.databaseId);
  }

  return createIgniteWorkspaceDatabase(params.token);
}

async function createNotionPageForEntry(
  token: string,
  database: NotionDatabaseInfo,
  entry: KnowledgeEntry,
): Promise<{ pageId: string; pageUrl?: string }> {
  const payload = {
    parent: {
      type: 'data_source_id',
      data_source_id: database.dataSourceId,
    },
    properties: {
      [database.titlePropertyName]: {
        title: [
          {
            text: {
              content: truncateText(entry.title || formatEntryType(entry.type), 200),
            },
          },
        ],
      },
      Type: {
        select: {
          name: formatEntryType(entry.type),
        },
      },
    },
    children: buildKnowledgeEntryBlocks(entry),
  };

  const response = await notionRequest<{ id: string; url?: string }>(
    '/pages',
    token,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  return {
    pageId: response.id,
    pageUrl: response.url,
  };
}

export async function syncKnowledgeEntriesToNotion(params: {
  token: string;
  databaseInput: string;
  entries: KnowledgeEntry[];
}): Promise<NotionSyncResult> {
  const database = await verifyNotionDatabase(params.token, params.databaseInput);
  const result: NotionSyncResult = { synced: [], failed: [] };

  for (const entry of params.entries) {
    try {
      const page = await createNotionPageForEntry(params.token, database, entry);
      result.synced.push({
        entryId: entry.id,
        pageId: page.pageId,
        pageUrl: page.pageUrl,
      });
    } catch (error) {
      result.failed.push({
        entryId: entry.id,
        message: error instanceof Error ? error.message : '同步失败',
      });
    }
  }

  return result;
}
