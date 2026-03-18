import { useMemo, useState, useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown, Check } from 'lucide-react';
import type { ProjectSummary } from '../types';
import type { Filters } from './FilterBar';
import { formatDateShort } from '../utils/format';

const COLORS = [
  '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6',
  '#facc15', '#22d3ee', '#f87171', '#a3e635', '#c084fc',
];

function projectColor(index: number) {
  return COLORS[index % COLORS.length];
}

interface Props {
  projects: ProjectSummary[];
  filters: Filters;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  nameMap: Record<string, string>;
}

function ChartTooltip({ active, payload, label, nameMap }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const items = [...payload].filter(p => p.value > 0).reverse();
  const total = items.reduce((s, p) => s + p.value, 0);
  if (total === 0) return null;
  return (
    <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, padding: '8px 12px', fontSize: 12, maxWidth: 240 }}>
      <p style={{ color: '#a1a1aa', marginBottom: 6 }}>{label}</p>
      {items.map(item => (
        <div key={item.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, flexShrink: 0 }} />
          <span style={{ color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
            {nameMap[item.dataKey] ?? item.dataKey}
          </span>
          <span style={{ color: '#a1a1aa', marginLeft: 'auto', paddingLeft: 12 }}>${item.value.toFixed(2)}</span>
        </div>
      ))}
      {items.length > 1 && (
        <div style={{ borderTop: '1px solid #3f3f46', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#71717a' }}>Total</span>
          <span style={{ color: '#34d399', fontWeight: 600 }}>${total.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

export function GlobalCostChart({ projects, filters }: Props) {
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.totalCostUSD - a.totalCostUSD),
    [projects]
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(sortedProjects.map(p => p.id)));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const p of sortedProjects) {
        if (!next.has(p.id)) { next.add(p.id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [sortedProjects]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sortedProjects.map(p => p.id)));
  const clearAll  = () => setSelectedIds(new Set());

  const visibleProjects = sortedProjects.filter(p => selectedIds.has(p.id));

  const { data, nameMap, colorMap } = useMemo(() => {
    const cutoff = filters.lastDays !== null
      ? new Date(Date.now() - filters.lastDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : null;

    // Collect all dates that have actual cost
    const dateMap: Record<string, Record<string, number>> = {};
    for (const project of visibleProjects) {
      for (const day of project.byDay) {
        if (cutoff && day.date < cutoff) continue;
        if (day.costUSD <= 0) continue;
        if (!dateMap[day.date]) dateMap[day.date] = {};
        dateMap[day.date][project.id] = (dateMap[day.date][project.id] ?? 0) + day.costUSD;
      }
    }

    const allDates = Object.keys(dateMap).sort();
    if (allDates.length === 0) return { data: [], nameMap: {}, colorMap: {} };

    // Only include dates from the first activity date → today, but skip isolated early outliers
    // (gaps >14 days at the start mean the early dates are stranded outliers)
    let startIdx = 0;
    while (startIdx < allDates.length - 1) {
      const gapDays = (new Date(allDates[startIdx + 1]).getTime() - new Date(allDates[startIdx]).getTime()) / 86400000;
      if (gapDays > 14) startIdx++;
      else break;
    }
    const startDate = cutoff ?? allDates[startIdx];
    const today = new Date().toISOString().slice(0, 10);

    // Build contiguous date range — fill empty days with null (no bar rendered)
    const dates: string[] = [];
    const cur = new Date(startDate);
    const end = new Date(today);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    const data = dates.map(date => ({
      label: formatDateShort(date),
      ...(dateMap[date] ?? {}),
    }));

    const nameMap: Record<string, string> = {};
    const colorMap: Record<string, string> = {};
    sortedProjects.forEach((p, i) => {
      nameMap[p.id] = p.name;
      colorMap[p.id] = projectColor(i);
    });

    return { data, nameMap, colorMap };
  }, [visibleProjects, filters.lastDays, sortedProjects]);

  if (sortedProjects.length === 0) return null;

  const tickInterval = data.length > 45 ? 6 : data.length > 21 ? 3 : data.length > 14 ? 1 : 0;
  const selectedCount = selectedIds.size;
  const totalCount = sortedProjects.length;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Cost Trend</h2>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <span>{selectedCount === totalCount ? 'All projects' : `${selectedCount} / ${totalCount} projects`}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-20 py-1">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-700">
                <button onClick={selectAll} className="text-xs text-zinc-400 hover:text-white transition-colors">All</button>
                <button onClick={clearAll}  className="text-xs text-zinc-400 hover:text-white transition-colors">None</button>
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {sortedProjects.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-700 transition-colors text-left"
                  >
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: projectColor(i) }} />
                    <span className="text-xs text-zinc-300 truncate flex-1">{p.name}</span>
                    {selectedIds.has(p.id) && <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {data.length === 0 || visibleProjects.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-zinc-600 text-sm">
          No cost data for selected projects / range
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false} tickLine={false}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: '#71717a', fontSize: 11 }}
                axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`}
              />
              <Tooltip content={<ChartTooltip nameMap={nameMap} />} cursor={{ fill: '#27272a' }} />
              {visibleProjects.map((p, i) => (
                <Bar
                  key={p.id}
                  dataKey={p.id}
                  stackId="stack"
                  fill={colorMap[p.id]}
                  radius={i === visibleProjects.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>

          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {sortedProjects.map((p, i) => {
              const active = selectedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-all ${
                    active ? 'border-zinc-700 text-zinc-300' : 'border-zinc-800 text-zinc-600 opacity-50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: active ? projectColor(i) : '#52525b' }} />
                  {p.name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
