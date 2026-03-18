import { useMemo } from 'react';
import type { ProjectSummary } from '../types';
import type { Filters } from './FilterBar';
import { formatCost } from '../utils/format';

interface Props {
  projects: ProjectSummary[];
  filters: Filters;
}

function intensityColor(cost: number): string {
  if (cost <= 0) return 'bg-zinc-800/60';
  if (cost < 1)  return 'bg-emerald-900/80';
  if (cost < 5)  return 'bg-emerald-700/80';
  if (cost < 20) return 'bg-emerald-600';
  if (cost < 50) return 'bg-emerald-500';
  return 'bg-emerald-400';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GAP     = 2;
const CELL_H  = 11;
const DAY_LABEL_W = 28;

// How many weeks to show depending on the active days filter
function weeksForDays(lastDays: number | null): number {
  if (lastDays === null) return 53;
  if (lastDays <= 7)   return 2;
  if (lastDays <= 14)  return 3;
  if (lastDays <= 30)  return 5;
  if (lastDays <= 60)  return 9;
  if (lastDays <= 90)  return 14;
  return 53;
}

export function ActivityHeatmap({ projects, filters }: Props) {
  const { weeks, monthLabels, numWeeks } = useMemo(() => {
    const dateMap: Record<string, number> = {};
    for (const p of projects) {
      for (const d of p.byDay) {
        dateMap[d.date] = (dateMap[d.date] ?? 0) + d.costUSD;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);

    const cutoffIso = filters.lastDays !== null
      ? new Date(Date.now() - filters.lastDays * 86400000).toISOString().slice(0, 10)
      : null;

    const numWeeks = weeksForDays(filters.lastDays);

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay() - (numWeeks - 1) * 7);

    type Cell = { date: string; cost: number; isToday: boolean; isFuture: boolean; outOfRange: boolean };
    const weeks: Cell[][] = [];
    const monthLabels: Record<number, string> = {};
    let lastMonth = -1;

    for (let wi = 0; wi < numWeeks; wi++) {
      const week: Cell[] = [];
      for (let dow = 0; dow < 7; dow++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + wi * 7 + dow);
        const iso = d.toISOString().slice(0, 10);
        week.push({
          date: iso,
          cost: dateMap[iso] ?? 0,
          isToday: iso === todayIso,
          isFuture: d > today,
          outOfRange: cutoffIso !== null && iso < cutoffIso,
        });
        if (dow === 0 && d.getMonth() !== lastMonth) {
          lastMonth = d.getMonth();
          monthLabels[wi] = d.toLocaleString('default', { month: 'short' });
        }
      }
      weeks.push(week);
    }

    return { weeks, monthLabels, numWeeks };
  }, [projects, filters.lastDays]);

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `${DAY_LABEL_W}px repeat(${numWeeks}, 1fr)`,
    columnGap: GAP,
  } as const;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <h2 className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">Activity</h2>

      {/* Month labels */}
      <div style={{ ...gridStyle, marginBottom: 4 }}>
        <div />
        {Array.from({ length: numWeeks }, (_, wi) => (
          <div key={wi} className="text-zinc-500 text-[10px] leading-none select-none overflow-hidden">
            {monthLabels[wi] ?? ''}
          </div>
        ))}
      </div>

      {/* One row per day-of-week */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
        {DAYS.map((day, dow) => (
          <div key={day} style={gridStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              {dow % 2 === 1 && (
                <span className="text-zinc-600 text-[10px] leading-none select-none">{day.slice(0, 3)}</span>
              )}
            </div>
            {weeks.map((week, wi) => {
              const cell = week[dow];
              return (
                <div
                  key={wi}
                  title={cell.isFuture || cell.outOfRange ? '' : `${cell.date}: ${cell.cost > 0 ? formatCost(cell.cost) : 'no activity'}`}
                  style={{ height: CELL_H, borderRadius: 2, opacity: cell.outOfRange ? 0.2 : 1 }}
                  className={
                    cell.isFuture
                      ? 'bg-transparent'
                      : cell.isToday
                        ? 'ring-1 ring-white/40 ' + intensityColor(cell.cost)
                        : intensityColor(cell.cost)
                  }
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ ...gridStyle, marginTop: 10 }}>
        <div />
        <div style={{ gridColumn: `2 / span ${Math.min(numWeeks, 8)}`, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="text-zinc-600 text-[10px] select-none mr-0.5">Less</span>
          {(['bg-zinc-800/60', 'bg-emerald-900/80', 'bg-emerald-700/80', 'bg-emerald-600', 'bg-emerald-500', 'bg-emerald-400'] as const).map(c => (
            <div key={c} style={{ width: CELL_H, height: CELL_H, borderRadius: 2, flexShrink: 0 }} className={c} />
          ))}
          <span className="text-zinc-600 text-[10px] select-none ml-0.5">More</span>
        </div>
      </div>
    </div>
  );
}
