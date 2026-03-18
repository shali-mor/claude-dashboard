import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceArea,
} from 'recharts';
import type { DailyBucket } from '../types';
import { formatDateShort, shortModelName } from '../utils/format';

interface Props {
  days: DailyBucket[];
  metric: 'cost' | 'sessions' | 'messages';
}

const MODEL_COLORS: Record<string, string> = {
  opus:   '#a78bfa',
  sonnet: '#60a5fa',
  haiku:  '#34d399',
};

function modelKey(model: string): string {
  if (model.includes('opus'))   return 'opus';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('haiku'))  return 'haiku';
  return 'other';
}

function dominantModel(modelCosts: Record<string, number>): string {
  let best = '', bestCost = -1;
  for (const [m, c] of Object.entries(modelCosts)) {
    if (c > bestCost) { bestCost = c; best = m; }
  }
  return best;
}

// Group consecutive days by dominant model → produces background bands
function getModelBands(days: Array<{ label: string; modelCosts: Record<string, number> }>) {
  const bands: Array<{ model: string; color: string; x1: string; x2: string }> = [];
  if (days.length === 0) return bands;

  let cur = dominantModel(days[0].modelCosts);
  let start = days[0].label;

  for (let i = 1; i < days.length; i++) {
    const m = dominantModel(days[i].modelCosts);
    if (m !== cur) {
      bands.push({ model: cur, color: MODEL_COLORS[modelKey(cur)] ?? '#71717a', x1: start, x2: days[i - 1].label });
      cur = m;
      start = days[i].label;
    }
  }
  bands.push({ model: cur, color: MODEL_COLORS[modelKey(cur)] ?? '#71717a', x1: start, x2: days[days.length - 1].label });
  return bands;
}

function CostTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ payload: { modelCosts: Record<string, number>; total: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const models = Object.entries(d.modelCosts ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: '#a1a1aa', marginBottom: models.length > 1 ? 6 : 0 }}>{label}</p>
      {models.map(([m, c]) => (
        <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: MODEL_COLORS[modelKey(m)] ?? '#71717a', flexShrink: 0 }} />
          <span style={{ color: '#d4d4d8' }}>{shortModelName(m)}</span>
          <span style={{ color: '#a1a1aa', marginLeft: 'auto', paddingLeft: 16 }}>${c.toFixed(4)}</span>
        </div>
      ))}
      {models.length > 1 && (
        <div style={{ borderTop: '1px solid #3f3f46', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#71717a' }}>Total</span>
          <span style={{ color: '#34d399', fontWeight: 600 }}>${d.total.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}

export function ProjectDailyChart({ days, metric }: Props) {
  if (days.length === 0) {
    return <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">No daily data</div>;
  }

  if (metric === 'cost') {
    const data = days.map(d => ({
      label: formatDateShort(d.date),
      total: +d.costUSD.toFixed(4),
      modelCosts: d.modelCosts ?? {},
    }));

    const bands = getModelBands(data);

    // Build legend from unique models in this dataset
    const uniqueModels = Array.from(new Set(bands.map(b => b.model)));

    return (
      <div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-cost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />

            {/* Colored background bands per model */}
            {bands.map((b, i) => (
              <ReferenceArea
                key={i}
                x1={b.x1}
                x2={b.x2}
                fill={b.color}
                fillOpacity={0.07}
                stroke="none"
              />
            ))}

            <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1 ? `$${v.toFixed(0)}` : `$${v.toFixed(2)}`}
            />
            <Tooltip content={<CostTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#60a5fa"
              strokeWidth={2}
              fill="url(#grad-cost)"
              dot={false}
              activeDot={{ r: 4, stroke: '#18181b', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Model legend below chart */}
        {uniqueModels.length > 1 && (
          <div className="flex gap-4 justify-center mt-2">
            {uniqueModels.map(m => (
              <div key={m} className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="w-8 h-2 rounded-sm inline-block" style={{ background: MODEL_COLORS[modelKey(m)] ?? '#71717a', opacity: 0.4 }} />
                {shortModelName(m)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const barMeta = {
    sessions: { key: 'sessionCount', color: '#60a5fa', label: 'Sessions' },
    messages: { key: 'messageCount', color: '#a78bfa', label: 'Messages' },
  }[metric];

  const data = days.map(d => ({
    label: formatDateShort(d.date),
    value: d[barMeta.key as keyof DailyBucket] as number,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [String(v), barMeta.label]}
          labelStyle={{ color: '#a1a1aa' }}
          itemStyle={{ color: barMeta.color }}
        />
        <Bar dataKey="value" fill={barMeta.color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
