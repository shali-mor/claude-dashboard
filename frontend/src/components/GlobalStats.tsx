import { useMemo } from 'react';
import type { ProjectSummary } from '../types';
import type { Filters } from './FilterBar';
import { formatCost, formatTokens } from '../utils/format';
import { DollarSign, Zap, FolderOpen, MessageSquare } from 'lucide-react';

interface Props {
  projects: ProjectSummary[];   // unfiltered — we do range filtering internally
  filters: Filters;
  filteredCount: number;        // how many cards are shown (for the label)
}

function cutoffDate(lastDays: number): string {
  const d = new Date(Date.now() - lastDays * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function GlobalStats({ projects, filters, filteredCount }: Props) {
  const stats = useMemo(() => {
    const cutoff = filters.lastDays !== null ? cutoffDate(filters.lastDays) : null;

    let totalCost = 0, totalTokens = 0, totalSessions = 0, totalMessages = 0;

    for (const p of projects) {
      if (cutoff) {
        // Sum only buckets within the date range
        for (const day of p.byDay) {
          if (day.date < cutoff) continue;
          totalCost += day.costUSD;
          totalTokens += day.inputTokens + day.outputTokens + day.cacheReadTokens + day.cacheCreationTokens;
          totalSessions += day.sessionCount;
          totalMessages += day.messageCount;
        }
      } else {
        totalCost += p.totalCostUSD;
        totalTokens += p.totalInputTokens + p.totalOutputTokens + p.totalCacheReadTokens + p.totalCacheCreationTokens;
        totalSessions += p.sessionCount;
        totalMessages += p.messageCount;
      }
    }

    return { totalCost, totalTokens, totalSessions, totalMessages };
  }, [projects, filters.lastDays]);

  const rangeLabel = filters.lastDays !== null ? `Last ${filters.lastDays}d` : 'All time';

  const cards = [
    { label: 'Cost',     value: formatCost(stats.totalCost),              icon: DollarSign,   color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Tokens',   value: formatTokens(stats.totalTokens),          icon: Zap,          color: 'text-blue-400',    bg: 'bg-blue-400/10'    },
    { label: 'Projects', value: String(filteredCount),                     icon: FolderOpen,   color: 'text-violet-400',  bg: 'bg-violet-400/10'  },
    { label: 'Sessions', value: stats.totalSessions.toLocaleString(),      icon: MessageSquare,color: 'text-amber-400',   bg: 'bg-amber-400/10'   },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-zinc-600 text-xs">{rangeLabel}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${c.bg} flex-shrink-0`}>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div>
              <p className="text-zinc-500 text-xs">{c.label}</p>
              <p className="text-white font-bold text-lg leading-tight">{c.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
