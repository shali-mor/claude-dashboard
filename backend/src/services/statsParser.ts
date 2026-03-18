import fs from 'fs';
import path from 'path';
import { AggregateStats, DailyStats, ModelStats } from '../types';
import { calculateCost } from './sessionReader';

const CLAUDE_DIR = path.join(process.env.HOME || '', '.claude');
const STATS_CACHE_PATH = path.join(CLAUDE_DIR, 'stats-cache.json');

interface RawModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
  webSearchRequests: number;
}

// Actual format: arrays with a date field
interface RawDailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

interface RawDailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>; // model -> total token count only
}

interface RawStatsCache {
  version: number;
  totalSessions?: number;
  totalMessages?: number;
  longestSession?: { duration: number; messageCount: number; timestamp: number };
  firstSessionDate?: string;
  // Arrays (actual format)
  dailyActivity?: RawDailyActivity[];
  dailyModelTokens?: RawDailyModelTokens[];
  // Dict keyed by model with full breakdown
  modelUsage?: Record<string, RawModelUsage>;
}

export function getAggregateStats(): AggregateStats {
  const result: AggregateStats = {
    totalCostUSD: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheCreationTokens: 0,
    totalSessions: 0,
    totalMessages: 0,
    totalToolCalls: 0,
    byModel: {},
    byDay: [],
  };

  if (!fs.existsSync(STATS_CACHE_PATH)) return result;

  try {
    const raw: RawStatsCache = JSON.parse(fs.readFileSync(STATS_CACHE_PATH, 'utf-8'));

    result.totalSessions = raw.totalSessions ?? 0;
    result.totalMessages = raw.totalMessages ?? 0;
    result.longestSession = raw.longestSession;
    result.firstSessionDate = raw.firstSessionDate;

    // Model totals — calculate cost from tokens if stored value is 0
    if (raw.modelUsage) {
      for (const [model, usage] of Object.entries(raw.modelUsage)) {
        const tokens = {
          inputTokens: usage.inputTokens || 0,
          outputTokens: usage.outputTokens || 0,
          cacheReadTokens: usage.cacheReadInputTokens || 0,
          cacheCreationTokens: usage.cacheCreationInputTokens || 0,
        };
        const costUSD = usage.costUSD > 0 ? usage.costUSD : calculateCost(tokens, model);

        result.totalCostUSD += costUSD;
        result.totalInputTokens += tokens.inputTokens;
        result.totalOutputTokens += tokens.outputTokens;
        result.totalCacheReadTokens += tokens.cacheReadTokens;
        result.totalCacheCreationTokens += tokens.cacheCreationTokens;

        result.byModel[model] = {
          model,
          inputTokens: tokens.inputTokens,
          outputTokens: tokens.outputTokens,
          cacheReadInputTokens: tokens.cacheReadTokens,
          cacheCreationInputTokens: tokens.cacheCreationTokens,
          costUSD,
          webSearchRequests: usage.webSearchRequests || 0,
        };
      }
    }

    // Build daily activity map
    const activityByDate: Record<string, RawDailyActivity> = {};
    for (const entry of raw.dailyActivity || []) {
      activityByDate[entry.date] = entry;
      result.totalToolCalls += entry.toolCallCount || 0;
    }

    // Build daily model tokens map
    const tokensByDate: Record<string, Record<string, number>> = {};
    for (const entry of raw.dailyModelTokens || []) {
      tokensByDate[entry.date] = entry.tokensByModel || {};
    }

    // Merge into byDay
    const allDates = new Set([...Object.keys(activityByDate), ...Object.keys(tokensByDate)]);
    for (const date of Array.from(allDates).sort()) {
      const activity = activityByDate[date] || { messageCount: 0, sessionCount: 0, toolCallCount: 0, date };
      const modelTokens = tokensByDate[date] || {};

      const dayModels: Record<string, ModelStats> = {};
      for (const [model, totalTokens] of Object.entries(modelTokens)) {
        // Only total token count available at daily granularity — estimate cost proportionally
        const globalUsage = raw.modelUsage?.[model];
        const globalTotal = globalUsage
          ? globalUsage.inputTokens + globalUsage.outputTokens + globalUsage.cacheReadInputTokens + globalUsage.cacheCreationInputTokens
          : 0;
        const ratio = globalTotal > 0 ? totalTokens / globalTotal : 0;
        const globalModelEntry = result.byModel[model];
        const costUSD = globalModelEntry ? globalModelEntry.costUSD * ratio : 0;

        dayModels[model] = {
          model,
          inputTokens: totalTokens,
          outputTokens: 0,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
          costUSD,
          webSearchRequests: 0,
        };
      }

      const day: DailyStats = {
        date,
        messageCount: activity.messageCount || 0,
        sessionCount: activity.sessionCount || 0,
        toolCallCount: activity.toolCallCount || 0,
        models: dayModels,
      };

      result.byDay.push(day);
    }
  } catch {
    // Return empty stats on parse error
  }

  return result;
}
