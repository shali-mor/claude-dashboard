export interface ActiveSession {
  sessionId: string;
  pid: number;
  cwd: string;
  project: string;
  startedAt: number;
  durationMs: number;
  machineId: string;
  machineName: string;
}

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
  filePath: string;
  toolCounts: Record<string, number>;
}

export interface ProjectSummary {
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
  hasProjectConfig: boolean;
  byDay: DailyBucket[];
  toolCounts: Record<string, number>;
  machineId: string;
  machineName: string;
}

export interface ProjectDetail extends ProjectSummary {
  byDay: DailyBucket[];
  sessions: SessionSummary[];
}

export interface ProjectConfig {
  model?: string;
  effortLevel?: string;
  allowedCommands: string[];
  hooks: { event: string; matcher: string; command: string }[];
}

export interface AggregateStats {
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSessions: number;
  totalMessages: number;
  totalToolCalls: number;
}

export interface Plugin {
  name: string;
  scope: string;
  version?: string;
  installedAt: string;
  updatedAt?: string;
}

export interface GlobalConfig {
  model?: string;
  effortLevel?: string;
  plugins: Plugin[];
  budget?: { dailyLimit?: number; monthlyLimit?: number };
}

export interface ReplayBlock {
  kind: 'text' | 'tool_call' | 'tool_result';
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  isError?: boolean;
}

export interface ReplayMessage {
  role: 'user' | 'assistant';
  timestamp?: string;
  blocks: ReplayBlock[];
}

export interface RemoteMachine {
  id: string;
  name: string;
  url: string;
  online: boolean;
}
