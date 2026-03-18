import { X } from 'lucide-react';

export interface Filters {
  models: string[];       // empty = all
  minCost: number;        // 0 = no minimum
  lastDays: number | null; // null = all time
  machineIds: string[];   // empty = all
}

export const DEFAULT_FILTERS: Filters = { models: [], minCost: 0, lastDays: null, machineIds: [] };

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  totalCount: number;
  filteredCount: number;
  machines?: Array<{ id: string; name: string }>;
}

const MODEL_OPTIONS = [
  { key: 'opus',   label: 'Opus',   bg: 'bg-violet-500/10 text-violet-300 border-violet-500/30', active: 'bg-violet-500/30 border-violet-400' },
  { key: 'sonnet', label: 'Sonnet', bg: 'bg-blue-500/10 text-blue-300 border-blue-500/30',       active: 'bg-blue-500/30 border-blue-400' },
  { key: 'haiku',  label: 'Haiku',  bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', active: 'bg-emerald-500/30 border-emerald-400' },
];

const COST_OPTIONS = [
  { label: 'Any',   value: 0 },
  { label: '>$5',   value: 5 },
  { label: '>$20',  value: 20 },
  { label: '>$100', value: 100 },
];

const DAY_OPTIONS = [
  { label: 'All time', value: null },
  { label: '7d',  value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

export function FilterBar({ filters, onChange, totalCount, filteredCount, machines }: Props) {
  const isDefault =
    filters.models.length === 0 && filters.minCost === 0 && filters.lastDays === null && filters.machineIds.length === 0;

  const toggleModel = (key: string) => {
    const next = filters.models.includes(key)
      ? filters.models.filter(m => m !== key)
      : [...filters.models, key];
    onChange({ ...filters, models: next });
  };

  const toggleMachine = (id: string) => {
    const next = filters.machineIds.includes(id)
      ? filters.machineIds.filter(m => m !== id)
      : [...filters.machineIds, id];
    onChange({ ...filters, machineIds: next });
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Filters</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-600">
            {filteredCount < totalCount
              ? <>{filteredCount} <span className="text-zinc-700">/ {totalCount} projects</span></>
              : <>{totalCount} projects</>
            }
          </span>
          {!isDefault && (
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-3 h-3" /> clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {/* Model filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 w-10">Model</span>
          <div className="flex gap-1.5">
            {MODEL_OPTIONS.map(m => {
              const on = filters.models.includes(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => toggleModel(m.key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${on ? m.active : m.bg} ${on ? 'font-medium' : ''}`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-zinc-800 self-stretch" />

        {/* Cost filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 w-8">Cost</span>
          <div className="flex gap-1.5">
            {COST_OPTIONS.map(c => {
              const on = filters.minCost === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => onChange({ ...filters, minCost: c.value })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    on
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-medium'
                      : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-zinc-800 self-stretch" />

        {/* Days filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 w-16">Last active</span>
          <div className="flex gap-1.5">
            {DAY_OPTIONS.map(d => {
              const on = filters.lastDays === d.value;
              return (
                <button
                  key={String(d.value)}
                  onClick={() => onChange({ ...filters, lastDays: d.value })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    on
                      ? 'bg-zinc-600 text-white border-zinc-500 font-medium'
                      : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Machine filter — only shown when 2+ machines are configured */}
        {machines && machines.length >= 2 && (
          <>
            <div className="w-px bg-zinc-800 self-stretch" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 w-14">Machine</span>
              <div className="flex gap-1.5">
                {machines.map(m => {
                  const on = filters.machineIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleMachine(m.id)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        on
                          ? 'bg-sky-500/30 text-sky-300 border-sky-400 font-medium'
                          : 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:border-sky-400'
                      }`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
