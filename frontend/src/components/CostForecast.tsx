import { useMemo, useState } from 'react';
import { TrendingUp, Zap, Bot, Scissors, FileText, Copy, Check } from 'lucide-react';
import type { ProjectSummary } from '../types';
import { formatCost } from '../utils/format';

interface Props {
  projects: ProjectSummary[];
}

interface Strategy {
  icon: React.ElementType;
  label: string;
  saving: string;
  savingUSD: number;
  color: string;
  detail: string;
  project: string;
  snippet: string;
  snippetLabel: string;
}

// Returns projected end-of-month cost for a project.
// If the project has current-month activity, extrapolate from pace so far.
// Otherwise fall back to average monthly rate across all history.
function projectMonthly(p: ProjectSummary): number {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();

  const monthCost = p.byDay
    .filter(d => d.date.startsWith(prefix))
    .reduce((s, d) => s + d.costUSD, 0);

  if (monthCost > 0) {
    return (monthCost / dayOfMonth) * daysInMonth;
  }

  // Fallback: average monthly rate from all-time history
  const months = new Set(p.byDay.map(d => d.date.slice(0, 7))).size;
  return months > 0 ? p.totalCostUSD / months : 0;
}

function computeStrategies(projects: ProjectSummary[]): Strategy[] {
  if (projects.length === 0) return [];

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();

  // Rank every project by monthly cost — highest cost projects get suggestions first
  const ranked = [...projects]
    .map(p => ({ p, monthly: projectMonthly(p) }))
    .filter(({ monthly }) => monthly > 0)
    .sort((a, b) => b.monthly - a.monthly);

  const strategies: Strategy[] = [];

  for (const { p, monthly } of ranked) {
    if (strategies.length >= projects.length) break; // compute for all projects

    const toolRatio = p.messageCount > 0 ? p.toolCallCount / p.messageCount : 0;
    const avgInputK = p.messageCount > 0 ? p.totalInputTokens / p.messageCount / 1000 : 0;
    const usesOpus = p.models.some(m => m.includes('opus'));
    const usesSonnet = p.models.some(m => m.includes('sonnet'));
    const usesHaiku = p.models.every(m => m.includes('haiku'));

    if (usesOpus) {
      // Best saving: switch to Sonnet (~80% cheaper)
      const est = monthly * 0.78;
      strategies.push({
        icon: Bot,
        label: `${p.name}: Opus → Sonnet`,
        saving: `~${formatCost(est)} by month end`,
        savingUSD: est,
        color: 'text-violet-400',
        project: p.name,
        detail: `${p.name} is on track to spend ~${formatCost(monthly)} this month using Opus. Sonnet 4.6 is 5× cheaper with near-identical quality for most tasks. Switching saves ~${formatCost(est)} by month end. Add to CLAUDE.md:`,
        snippet: `model: claude-sonnet-4-6`,
        snippetLabel: `${p.cwd}/CLAUDE.md`,
      });
    } else if (!usesHaiku && toolRatio > 1.5) {
      // Tool-heavy Sonnet project → Haiku for tool work (92% cheaper)
      const est = monthly * 0.65 * 0.92;
      strategies.push({
        icon: Zap,
        label: `${p.name}: tool work → Haiku`,
        saving: `~${formatCost(est)} by month end`,
        savingUSD: est,
        color: 'text-yellow-400',
        project: p.name,
        detail: `${p.name} is on track for ~${formatCost(monthly)} this month, averaging ${toolRatio.toFixed(1)} tool calls per message. File reads, edits and searches don't need ${usesSonnet ? 'Sonnet' : 'a large model'}. Routing 65% to Haiku saves ~${formatCost(est)} by month end:`,
        snippet: `model: claude-haiku-4-5-20251001`,
        snippetLabel: `${p.cwd}/CLAUDE.md`,
      });
    } else if (!usesHaiku && avgInputK > 4) {
      // Large context → /compact saves ~35% of input cost
      const est = monthly * 0.35;
      strategies.push({
        icon: Scissors,
        label: `${p.name}: trim context`,
        saving: `~${formatCost(est)} by month end`,
        savingUSD: est,
        color: 'text-emerald-400',
        project: p.name,
        detail: `${p.name} is on track for ~${formatCost(monthly)} this month with ~${Math.round(avgInputK)}K input tokens per message. Trimming context 35% with /compact saves ~${formatCost(est)} by month end. Add to CLAUDE.md:`,
        snippet: `# Context management\nRun /compact when switching to a new task.\nDo not carry context from previous unrelated work into new tasks.`,
        snippetLabel: `${p.cwd}/CLAUDE.md`,
      });
    } else if (!usesHaiku) {
      // Default: move part of sessions to Haiku
      const est = monthly * 0.5 * 0.92;
      strategies.push({
        icon: Zap,
        label: `${p.name}: partial Haiku`,
        saving: `~${formatCost(est)} by month end`,
        savingUSD: est,
        color: 'text-yellow-400',
        project: p.name,
        detail: `${p.name} is on track for ~${formatCost(monthly)} this month. Routing half its sessions to Haiku (12× cheaper for routine work) saves ~${formatCost(est)} by month end. Add to CLAUDE.md:`,
        snippet: `model: claude-haiku-4-5-20251001`,
        snippetLabel: `${p.cwd}/CLAUDE.md`,
      });
    } else if (!p.hasProjectConfig) {
      // Already on Haiku but no CLAUDE.md — save repeated setup tokens
      const sessionsLeft = Math.round((p.sessionCount / now.getDate()) * daysLeft);
      const est = sessionsLeft * 2000 * 3 / 1_000_000;
      strategies.push({
        icon: FileText,
        label: `${p.name}: add CLAUDE.md`,
        saving: `~${formatCost(est)} by month end`,
        savingUSD: est,
        color: 'text-blue-400',
        project: p.name,
        detail: `${p.name} has ~${sessionsLeft} sessions left this month without a CLAUDE.md. You re-send ~2K tokens of context each time. Eliminating that saves ~${formatCost(est)} by month end. Starter:`,
        snippet: `# ${p.name}\n\n## Project overview\n<!-- 2-3 lines: what this project does -->\n\n## Model\nmodel: claude-sonnet-4-6\n\n## Key conventions\n<!-- Coding style, folder structure, important patterns -->`,
        snippetLabel: `${p.cwd}/CLAUDE.md`,
      });
    }
  }

  return strategies.filter(s => s.savingUSD >= 50);
}

function SnippetTip({ strategy, open }: { strategy: Strategy; open: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(strategy.snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 mb-1 w-72 bg-zinc-800 border border-zinc-600 rounded-xl shadow-2xl z-50">
      <div className="px-3 pt-3 pb-2">
        <p className="text-zinc-200 text-xs leading-relaxed mb-2">{strategy.detail}</p>
        <div className="bg-zinc-900 rounded-lg border border-zinc-700 overflow-hidden">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-700">
            <span className="text-zinc-500 text-[10px] font-mono truncate">{strategy.snippetLabel}</span>
            <button
              onClick={copy}
              className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors ml-2 flex-shrink-0"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="px-2.5 py-2 text-[11px] text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">{strategy.snippet}</pre>
        </div>
      </div>
      <div className="absolute top-full left-4 border-4 border-transparent border-t-zinc-600" />
    </div>
  );
}

function StrategyChip({ s }: { s: Strategy }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 cursor-default transition-colors border border-zinc-700/50">
        <s.icon className={`w-3 h-3 flex-shrink-0 ${s.color}`} />
        <span className="text-zinc-300 text-xs whitespace-nowrap">{s.label}</span>
        <span className={`text-[10px] font-medium ${s.color} whitespace-nowrap`}>{s.saving}</span>
      </div>
      <SnippetTip strategy={s} open={open} />
    </div>
  );
}

export function CostForecast({ projects }: Props) {
  const forecast = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${month}`;
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();

    const dayMap: Record<string, number> = {};
    for (const p of projects) {
      for (const d of p.byDay) {
        if (!d.date.startsWith(prefix)) continue;
        dayMap[d.date] = (dayMap[d.date] ?? 0) + d.costUSD;
      }
    }

    const entries = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b));
    const actualCost = entries.reduce((s, [, v]) => s + v, 0);

    if (entries.length < 2) {
      return { actualCost, projectedTotal: null, daysInMonth, dayOfMonth, daysLeft: daysInMonth - dayOfMonth };
    }

    const points = entries.map(([date, cost]) => ({ x: parseInt(date.slice(8)), y: cost }));
    const n = points.length;
    const sumX  = points.reduce((s, p) => s + p.x, 0);
    const sumY  = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n;

    let projected = actualCost;
    for (let d = dayOfMonth + 1; d <= daysInMonth; d++) {
      projected += Math.max(0, slope * d + intercept);
    }

    return { actualCost, projectedTotal: projected, daysInMonth, dayOfMonth, daysLeft: daysInMonth - dayOfMonth };
  }, [projects]);

  const allStrategies = useMemo(() => computeStrategies(projects), [projects]);
  const strategies = allStrategies.slice(0, 4);
  const totalSaving = allStrategies.reduce((s, x) => s + x.savingUSD, 0);

  if (forecast.projectedTotal === null) return null;

  const pct = Math.min(100, (forecast.actualCost / forecast.projectedTotal) * 100);
  const isHigh = forecast.projectedTotal > 100;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex flex-col sm:flex-row gap-5">

      {/* Left — forecast numbers */}
      <div className="flex-shrink-0 min-w-[200px]">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Month Forecast</span>
          <span className="text-zinc-600 text-xs ml-auto">{forecast.daysLeft}d left</span>
        </div>
        <div className="flex items-end gap-3 mb-3">
          <div>
            <p className="text-zinc-500 text-[10px]">Spent so far</p>
            <p className="text-white text-lg font-bold">{formatCost(forecast.actualCost)}</p>
          </div>
          <span className="text-zinc-600 mb-0.5 text-sm">→</span>
          <div>
            <p className="text-zinc-500 text-[10px]">Projected</p>
            <p className={`text-lg font-bold ${isHigh ? 'text-amber-400' : 'text-emerald-400'}`}>
              {formatCost(forecast.projectedTotal)}
            </p>
          </div>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${isHigh ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-zinc-600 text-[10px] mt-1">{Math.round(pct)}% of projected spend</p>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px bg-zinc-800 self-stretch" />

      {/* Right — savings strategies */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <p className="text-zinc-300 text-xs font-medium">How can you reduce your costs?</p>
          <p className="text-emerald-400 text-sm font-bold">Save up to {formatCost(totalSaving)}</p>
        </div>
        <p className="text-zinc-500 text-[10px] mb-3">
          Across {allStrategies.length} project{allStrategies.length !== 1 ? 's' : ''} — hover for details &amp; copy-paste snippet
        </p>
        <div className="flex flex-wrap gap-1.5">
          {strategies.map(s => <StrategyChip key={s.label} s={s} />)}
        </div>
      </div>

    </div>
  );
}
