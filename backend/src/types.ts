export interface ActiveSession {
  sessionId: string;
  pid: number;
  cwd: string;
  project: string;
  startedAt: number;
  durationMs: number;
}

export interface SessionStats {
  sessionId: string;
  project: string;
  cwd: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  model: string;
  gitBranch?: string;
  messageCount: number;
  toolCallCount: number;
  subagentCount: number;
  tokens: TokenUsage;
  costUSD: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export interface ModelStats {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
  webSearchRequests: number;
}

export interface DailyStats {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
  models: Record<string, ModelStats>;
}

export interface AggregateStats {
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalSessions: number;
  totalMessages: number;
  totalToolCalls: number;
  byModel: Record<string, ModelStats>;
  byDay: DailyStats[];
  firstSessionDate?: string;
  longestSession?: {
    duration: number;
    messageCount: number;
    timestamp: number;
  };
}

export interface HistoryEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
}

export interface Plugin {
  name: string;
  scope: string;
  installPath: string;
  version?: string;
  installedAt: string;
  updatedAt?: string;
}

export interface ClaudeConfig {
  model?: string;
  effortLevel?: string;
  hooks?: Record<string, unknown>;
  plugins: Plugin[];
  budget?: {
    dailyLimit?: number;
    monthlyLimit?: number;
  };
}
