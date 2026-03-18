import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { ActiveSession, SessionStats, TokenUsage } from '../types';

const CLAUDE_DIR = path.join(process.env.HOME || '', '.claude');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// Model pricing per 1M tokens (as of 2025)
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-opus-4':          { input: 15,   output: 75,   cacheRead: 1.5,  cacheWrite: 18.75 },
  'claude-opus-4-5':        { input: 15,   output: 75,   cacheRead: 1.5,  cacheWrite: 18.75 },
  'claude-opus-4-6':        { input: 15,   output: 75,   cacheRead: 1.5,  cacheWrite: 18.75 },
  'claude-sonnet-4':        { input: 3,    output: 15,   cacheRead: 0.3,  cacheWrite: 3.75  },
  'claude-sonnet-4-5':      { input: 3,    output: 15,   cacheRead: 0.3,  cacheWrite: 3.75  },
  'claude-sonnet-4-6':      { input: 3,    output: 15,   cacheRead: 0.3,  cacheWrite: 3.75  },
  'claude-haiku-4':         { input: 0.8,  output: 4,    cacheRead: 0.08, cacheWrite: 1     },
  'claude-haiku-4-5':       { input: 0.8,  output: 4,    cacheRead: 0.08, cacheWrite: 1     },
};

function getModelPricing(model: string) {
  const key = Object.keys(MODEL_PRICING).find(k => model.toLowerCase().includes(k.toLowerCase()));
  return key ? MODEL_PRICING[key] : { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 };
}

export function calculateCost(tokens: TokenUsage, model: string): number {
  const p = getModelPricing(model);
  return (
    (tokens.inputTokens * p.input +
      tokens.outputTokens * p.output +
      tokens.cacheReadTokens * p.cacheRead +
      tokens.cacheCreationTokens * p.cacheWrite) /
    1_000_000
  );
}

export function getActiveSessions(): ActiveSession[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];

  const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  const now = Date.now();
  const sessions: ActiveSession[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8');
      const data = JSON.parse(raw);

      // Verify process is still alive
      try {
        process.kill(data.pid, 0);
      } catch {
        continue; // Process is dead, skip
      }

      const cwdParts = (data.cwd || '').split('/');
      sessions.push({
        sessionId: data.sessionId,
        pid: data.pid,
        cwd: data.cwd,
        project: cwdParts[cwdParts.length - 1] || data.cwd,
        startedAt: data.startedAt,
        durationMs: now - data.startedAt,
      });
    } catch {
      // Skip malformed files
    }
  }

  return sessions.sort((a, b) => b.startedAt - a.startedAt);
}

async function parseSessionJSONL(filePath: string): Promise<SessionStats | null> {
  if (!fs.existsSync(filePath)) return null;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let model = 'unknown';
  let gitBranch: string | undefined;
  let messageCount = 0;
  let toolCallCount = 0;
  let subagentCount = 0;
  let startedAt: string | undefined;
  let endedAt: string | undefined;
  let sessionId: string | undefined;
  let cwd: string | undefined;
  const tokens: TokenUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);

      if (!sessionId && entry.sessionId) sessionId = entry.sessionId;
      if (!cwd && entry.cwd) cwd = entry.cwd;
      if (!gitBranch && entry.gitBranch) gitBranch = entry.gitBranch;
      if (!startedAt && entry.timestamp) startedAt = entry.timestamp;
      if (entry.timestamp) endedAt = entry.timestamp;

      // Extract model from assistant messages
      if (entry.type === 'assistant' && entry.message?.model) {
        model = entry.message.model;
      }

      // Count messages
      if (entry.type === 'user' || entry.type === 'assistant') {
        messageCount++;
      }

      // Extract token usage from assistant messages
      if (entry.type === 'assistant' && entry.message?.usage) {
        const u = entry.message.usage;
        tokens.inputTokens += u.input_tokens || 0;
        tokens.outputTokens += u.output_tokens || 0;
        tokens.cacheReadTokens += u.cache_read_input_tokens || 0;
        tokens.cacheCreationTokens += u.cache_creation_input_tokens || 0;
      }

      // Count tool calls
      if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_use') toolCallCount++;
        }
      }

      // Count subagents
      if (entry.type === 'tool_result' && entry.toolName === 'Agent') {
        subagentCount++;
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (!sessionId) return null;

  const cwdParts = (cwd || '').split('/');
  const project = cwdParts[cwdParts.length - 1] || cwd || 'unknown';
  const durationMs =
    startedAt && endedAt ? new Date(endedAt).getTime() - new Date(startedAt).getTime() : undefined;

  return {
    sessionId,
    project,
    cwd: cwd || '',
    startedAt: startedAt || '',
    endedAt,
    durationMs,
    model,
    gitBranch,
    messageCount,
    toolCallCount,
    subagentCount,
    tokens,
    costUSD: calculateCost(tokens, model),
  };
}

export async function getSessionHistory(limit = 50): Promise<SessionStats[]> {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const sessions: SessionStats[] = [];
  const projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const projectDir of projectDirs) {
    const projectPath = path.join(PROJECTS_DIR, projectDir);
    const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));

    for (const file of files) {
      const filePath = path.join(projectPath, file);
      const stats = fs.statSync(filePath);
      // Skip empty files
      if (stats.size < 100) continue;

      const session = await parseSessionJSONL(filePath);
      if (session) sessions.push(session);
    }
  }

  return sessions
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);
}

export async function getSessionById(sessionId: string): Promise<SessionStats | null> {
  if (!fs.existsSync(PROJECTS_DIR)) return null;

  const projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const projectDir of projectDirs) {
    const filePath = path.join(PROJECTS_DIR, projectDir, `${sessionId}.jsonl`);
    if (fs.existsSync(filePath)) {
      return parseSessionJSONL(filePath);
    }
  }
  return null;
}

export function killSession(pid: number): { success: boolean; message: string } {
  try {
    process.kill(pid, 'SIGTERM');
    return { success: true, message: `Sent SIGTERM to PID ${pid}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to kill PID ${pid}: ${msg}` };
  }
}
