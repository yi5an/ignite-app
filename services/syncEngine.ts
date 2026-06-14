import { Directory, File, Paths } from 'expo/node_modules/expo-file-system';
import { KnowledgeEntry, SyncSettings, Task } from '../types';

export interface SyncDraftSection {
  heading: string;
  lines: string[];
}

export interface SyncDraft {
  title: string;
  sections: SyncDraftSection[];
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

function buildTaskLines(tasks: Task[]): string[] {
  if (tasks.length === 0) return ['- 暂无今日计划'];
  return tasks.map((task) => {
    const completedSteps = task.steps.filter((step) => step.isCompleted).length;
    return `- ${task.title} (${completedSteps}/${task.steps.length} 步)`;
  });
}

function buildEntryLines(entries: KnowledgeEntry[]): string[] {
  if (entries.length === 0) return ['- 暂无记录'];
  return entries.map((entry) => `- ${entry.title} · ${formatDateLabel(entry.createdAt)}`);
}

export function buildSyncDraft(
  tasks: Task[],
  entries: KnowledgeEntry[],
  settings: SyncSettings,
): SyncDraft {
  const notes = entries.filter((entry) => entry.type === 'notes');
  const practice = entries.filter((entry) => entry.type === 'practice');
  const summaries = entries.filter((entry) => entry.type === 'summaries');

  const sections = [
    settings.syncPlans ? { heading: '今天的计划', lines: buildTaskLines(tasks) } : null,
    settings.syncNotes ? { heading: '随手笔记', lines: buildEntryLines(notes) } : null,
    settings.syncPractice ? { heading: '习题记录', lines: buildEntryLines(practice) } : null,
    settings.syncSummaries ? { heading: '总结', lines: buildEntryLines(summaries) } : null,
  ].filter(Boolean) as SyncDraftSection[];

  return {
    title: `Ignite / ${new Date().toISOString().slice(0, 10)} / 知识同步草稿`,
    sections,
  };
}

export function renderSyncDraftMarkdown(draft: SyncDraft): string {
  const lines: string[] = [`# ${draft.title}`, ''];

  for (const section of draft.sections) {
    lines.push(`## ${section.heading}`);
    lines.push(...section.lines);
    lines.push('');
  }

  return lines.join('\n').trim();
}

export async function exportSyncDraftMarkdown(
  markdown: string,
): Promise<string> {
  const exportDir = new Directory(Paths.document, 'ignite-exports');
  exportDir.create({ idempotent: true, intermediates: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = new File(exportDir, `ignite-sync-${stamp}.md`);
  file.create({ overwrite: true, intermediates: true });
  file.write(markdown);

  return file.uri;
}
