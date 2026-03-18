import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { calculateCost } from './sessionReader';

const CLAUDE_DIR = path.join(process.env.HOME || '', '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

export interface DailyBucket {
  date: string;
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  sessionCount: number;
  messageCount: number;
  modelCosts: Record<string, number>;
}

export interface SessionSummary {
  sessionId: string;
  filePath: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  model: string;
  gitBranch?: string;
  messageCount: number;
  toolCallCount: number;
  subagentCount: number;
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  toolCounts: Record<string, number>;
}

export interface ProjectStats {
  id: string;
  name: string;
  cwd: string;
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  sessionCount: number;
  messageCount: number;
  toolCallCount: number;
  models: string[];
  lastActiveAt: string;
  byDay: DailyBucket[];
  sessions: SessionSummary[];
  hasProjectConfig: boolean;
  toolCounts: Record<string, number>;
}

function cwdToId(cwd: string): string {
  return cwd.replace(/\//g, '_').replace(/^_/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function cwdToName(cwd: string): string {
  const parts = cwd.split('/').filter(Boolean);
  return parts[parts.length - 1] || cwd;
}

function shouldSkipCwd(cwd: string): boolean {
  if (!cwd) return true;
  if (cwd.includes('worktrees') || cwd.includes('.claude/worktrees')) return true;
  if (cwd.includes('/.claude/')) return true;
  const parts = cwd.split('/').filter(Boolean);
  if (parts.length < 4) return true;
  const name = parts[parts.length - 1];
  const skip = ['commands', 'Downloads', 'WeeklyReport', '.claude'];
  if (skip.some(s => name === s || name.includes(s))) return true;
  if (cwd.endsWith('/.claude')) return true;
  return false;
}

function readCwdFromFile(filePath: string): string | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16384);
    const bytesRead = fs.readSync(fd, buf, 0, 16384, 0);
    fs.closeSync(fd);
    const chunk = buf.subarray(0, bytesRead).toString('utf-8');
    for (const line of chunk.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.cwd) return entry.cwd;
      } catch { /* next line */ }
    }
    return null;
  } catch {
    return null;
  }
}

function cleanModel(model: string): string | null {
  if (!model || model === 'unknown' || model.includes('synthetic') || model.includes('<')) return null;
  return model;
}

async function parseSessionFile(filePath: string): Promise<SessionSummary | null> {
  const stat = fs.statSync(filePath);
  if (stat.size < 100) return null;

  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  let model = 'unknown';
  let gitBranch: string | undefined;
  let messageCount = 0;
  let toolCallCount = 0;
  let subagentCount = 0;
  let startedAt = '';
  let endedAt = '';
  let sessionId = '';
  let inputTokens = 0, outputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0;
  const toolCounts: Record<string, number> = {};

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (!sessionId && e.sessionId) sessionId = e.sessionId;
      if (!gitBranch && e.gitBranch) gitBranch = e.gitBranch;
      if (!startedAt && e.timestamp) startedAt = e.timestamp;
      if (e.timestamp) endedAt = e.timestamp;

      if (e.type === 'assistant' && e.message?.model) {
        const m = cleanModel(e.message.model);
        if (m) model = m;
      }
      if (e.type === 'user' || e.type === 'assistant') messageCount++;

      if (e.type === 'assistant' && e.message?.usage) {
        const u = e.message.usage;
        inputTokens += u.input_tokens || 0;
        outputTokens += u.output_tokens || 0;
        cacheReadTokens += u.cache_read_input_tokens || 0;
        cacheCreationTokens += u.cache_creation_input_tokens || 0;
      }

      if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
        for (const b of e.message.content) {
          if (b.type === 'tool_use') {
            toolCallCount++;
            const toolName = b.name as string;
            toolCounts[toolName] = (toolCounts[toolName] ?? 0) + 1;
          }
          if (b.type === 'tool_use' && b.name === 'Agent') subagentCount++;
        }
      }
    } catch { /* skip */ }
  }

  if (!sessionId || !startedAt) return null;

  const durationMs = endedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : 0;
  const costUSD = calculateCost({ inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens }, model);

  return {
    sessionId, filePath, startedAt, endedAt, durationMs, model, gitBranch,
    messageCount, toolCallCount, subagentCount, costUSD,
    inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens,
    toolCounts,
  };
}

function getDateFromTimestamp(iso: string): string {
  return iso.slice(0, 10);
}

let _cache: ProjectStats[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000;

export async function getAllProjects(forceRefresh = false): Promise<ProjectStats[]> {
  if (!forceRefresh && _cache && Date.now() - _cacheTime < CACHE_TTL_MS) return _cache;

  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const cwdMap: Record<string, string[]> = {};
  for (const dir of projectDirs) {
    const dirPath = path.join(PROJECTS_DIR, dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));
    if (files.length === 0) continue;

    const cwd = readCwdFromFile(path.join(dirPath, files[0]));
    if (!cwd || shouldSkipCwd(cwd)) continue;

    if (!cwdMap[cwd]) cwdMap[cwd] = [];
    for (const f of files) cwdMap[cwd].push(path.join(dirPath, f));
  }

  const results: ProjectStats[] = [];

  for (const [cwd, files] of Object.entries(cwdMap)) {
    const sessions: SessionSummary[] = [];

    for (const filePath of files) {
      const s = await parseSessionFile(filePath);
      if (s) sessions.push(s);
    }

    if (sessions.length === 0) continue;

    sessions.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

    let totalCostUSD = 0, totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheCreate = 0;
    let totalMessages = 0, totalTools = 0;
    const modelsSet = new Set<string>();
    const dayMap: Record<string, DailyBucket> = {};
    const toolCounts: Record<string, number> = {};

    for (const s of sessions) {
      totalCostUSD += s.costUSD;
      totalInput += s.inputTokens;
      totalOutput += s.outputTokens;
      totalCacheRead += s.cacheReadTokens;
      totalCacheCreate += s.cacheCreationTokens;
      totalMessages += s.messageCount;
      totalTools += s.toolCallCount;
      if (cleanModel(s.model)) modelsSet.add(s.model);

      // Aggregate tool counts
      for (const [tool, count] of Object.entries(s.toolCounts)) {
        toolCounts[tool] = (toolCounts[tool] ?? 0) + count;
      }

      const date = getDateFromTimestamp(s.startedAt);
      if (!dayMap[date]) {
        dayMap[date] = { date, costUSD: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, sessionCount: 0, messageCount: 0, modelCosts: {} };
      }
      dayMap[date].costUSD += s.costUSD;
      const m = cleanModel(s.model);
      if (m && s.costUSD > 0) {
        dayMap[date].modelCosts[m] = (dayMap[date].modelCosts[m] ?? 0) + s.costUSD;
      }
      dayMap[date].inputTokens += s.inputTokens;
      dayMap[date].outputTokens += s.outputTokens;
      dayMap[date].cacheReadTokens += s.cacheReadTokens;
      dayMap[date].cacheCreationTokens += s.cacheCreationTokens;
      dayMap[date].sessionCount++;
      dayMap[date].messageCount += s.messageCount;
    }

    const byDay = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
    const lastSession = sessions[sessions.length - 1];

    const hasProjectConfig = fs.existsSync(path.join(cwd, '.claude', 'settings.local.json')) ||
      fs.existsSync(path.join(cwd, '.claude', 'settings.json'));

    results.push({
      id: cwdToId(cwd),
      name: cwdToName(cwd),
      cwd,
      totalCostUSD,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCacheReadTokens: totalCacheRead,
      totalCacheCreationTokens: totalCacheCreate,
      sessionCount: sessions.length,
      messageCount: totalMessages,
      toolCallCount: totalTools,
      models: Array.from(modelsSet),
      lastActiveAt: lastSession.endedAt || lastSession.startedAt,
      byDay,
      sessions: sessions.slice(-50).reverse(),
      hasProjectConfig,
      toolCounts,
    });
  }

  results.sort((a, b) => b.totalCostUSD - a.totalCostUSD);
  _cache = results;
  _cacheTime = Date.now();
  return results;
}

export async function getProjectById(id: string): Promise<ProjectStats | null> {
  const all = await getAllProjects();
  return all.find(p => p.id === id) ?? null;
}

export function invalidateCache() {
  _cache = null;
}

export async function getSessionMessages(projectId: string, sessionId: string): Promise<object[] | null> {
  const project = await getProjectById(projectId);
  if (!project) return null;

  const session = project.sessions.find(s => s.sessionId === sessionId);
  if (!session) return null;

  return readSessionMessages(session.filePath);
}

async function readSessionMessages(filePath: string): Promise<object[]> {
  const messages: object[] = [];

  if (!fs.existsSync(filePath)) return messages;

  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.type !== 'user' && e.type !== 'assistant') continue;
      if (!e.message?.content) continue;

      const blocks: object[] = [];
      const content = Array.isArray(e.message.content) ? e.message.content : [{ type: 'text', text: String(e.message.content) }];

      for (const block of content) {
        if (block.type === 'text' && block.text?.trim()) {
          blocks.push({ kind: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          blocks.push({
            kind: 'tool_call',
            toolName: block.name,
            toolInput: block.input,
          });
        } else if (block.type === 'tool_result') {
          const resultContent = Array.isArray(block.content)
            ? block.content.filter((c: {type: string}) => c.type === 'text').map((c: {text: string}) => c.text).join('\n')
            : String(block.content ?? '');
          if (resultContent.trim()) {
            blocks.push({
              kind: 'tool_result',
              text: resultContent.slice(0, 2000), // cap at 2KB per result
              isError: block.is_error ?? false,
            });
          }
        }
      }

      if (blocks.length > 0) {
        messages.push({
          role: e.type === 'user' ? 'user' : 'assistant',
          timestamp: e.timestamp,
          blocks,
        });
      }
    } catch { /* skip */ }
  }

  return messages;
}
