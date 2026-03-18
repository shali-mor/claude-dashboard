import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import type { ProjectSummary } from '../types';
import { formatCost } from '../utils/format';

interface Props {
  projects: ProjectSummary[];
  dailyLimit?: number;
  monthlyLimit?: number;
}

function getDailyCost(projects: ProjectSummary[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return projects.reduce((sum, p) => {
    const day = p.byDay.find(d => d.date === today);
    return sum + (day?.costUSD ?? 0);
  }, 0);
}

function getMonthlyCost(projects: ProjectSummary[]): number {
  const prefix = new Date().toISOString().slice(0, 7);
  return projects.reduce((sum, p) => {
    return sum + p.byDay
      .filter(d => d.date.startsWith(prefix))
      .reduce((s, d) => s + d.costUSD, 0);
  }, 0);
}

export function BudgetAlert({ projects, dailyLimit, monthlyLimit }: Props) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const alerts: Array<{ id: string; label: string; spent: number; limit: number; pct: number }> = [];

  if (dailyLimit && dailyLimit > 0) {
    const spent = getDailyCost(projects);
    const pct = (spent / dailyLimit) * 100;
    if (pct >= 70) alerts.push({ id: 'daily', label: 'Today', spent, limit: dailyLimit, pct });
  }

  if (monthlyLimit && monthlyLimit > 0) {
    const spent = getMonthlyCost(projects);
    const pct = (spent / monthlyLimit) * 100;
    if (pct >= 70) alerts.push({ id: 'monthly', label: 'This month', spent, limit: monthlyLimit, pct });
  }

  const visible = alerts.filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map(alert => {
        const exceeded = alert.pct >= 100;
        return (
          <div
            key={alert.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm ${
              exceeded
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium">{exceeded ? 'Budget exceeded' : 'Budget warning'}: </span>
              <span>
                {alert.label} — {formatCost(alert.spent)} / {formatCost(alert.limit)}
                {' '}({Math.round(alert.pct)}%)
              </span>
            </div>
            {/* Mini progress bar */}
            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex-shrink-0">
              <div
                className={`h-full rounded-full ${exceeded ? 'bg-red-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, alert.pct)}%` }}
              />
            </div>
            <button
              onClick={() => setDismissed(d => [...d, alert.id])}
              className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
