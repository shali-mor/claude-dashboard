import { useMemo } from 'react';
import type { ProjectSummary } from '../types';
import { Wrench } from 'lucide-react';

interface Props {
  project: ProjectSummary;
}

const TOOL_COLORS: Record<string, string> = {
  Bash:       '#60a5fa',
  Edit:       '#34d399',
  Read:       '#a78bfa',
  Write:      '#fb923c',
  Grep:       '#f472b6',
  Glob:       '#facc15',
  Agent:      '#22d3ee',
  WebSearch:  '#f87171',
  WebFetch:   '#a3e635',
  TodoWrite:  '#c084fc',
};

function toolColor(name: string): string {
  return TOOL_COLORS[name] ?? '#71717a';
}

export function ToolUsageChart({ project }: Props) {
  const tools = useMemo(() => {
    const entries = Object.entries(project.toolCounts ?? {});
    if (entries.length === 0) return [];
    const sorted = entries.sort((a, b) => b[1] - a[1]).slice(0, 12);
    const max = sorted[0][1];
    return sorted.map(([name, count]) => ({ name, count, pct: (count / max) * 100 }));
  }, [project.toolCounts]);

  if (tools.length === 0) return null;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="w-4 h-4 text-zinc-400" />
        <h3 className="text-white font-medium text-sm">Tool Usage</h3>
        <span className="text-zinc-600 text-xs">({project.toolCallCount.toLocaleString()} total calls)</span>
      </div>
      <div className="space-y-2">
        {tools.map(t => (
          <div key={t.name} className="flex items-center gap-3">
            <span className="text-zinc-400 text-xs w-20 text-right flex-shrink-0">{t.name}</span>
            <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
              <div
                className="h-full rounded flex items-center px-2 transition-all"
                style={{ width: `${t.pct}%`, background: toolColor(t.name) + '33', borderLeft: `3px solid ${toolColor(t.name)}` }}
              >
                <span className="text-[11px] font-mono" style={{ color: toolColor(t.name) }}>{t.count.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
