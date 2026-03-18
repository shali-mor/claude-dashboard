import { useState, useEffect } from 'react';
import { ChevronDown, Square, ExternalLink } from 'lucide-react';
import type { ActiveSession, ProjectSummary } from '../types';
import { formatDuration, formatCost, formatTokens, timeAgo, shortModelName, modelBg } from '../utils/format';

interface Props {
  session: ActiveSession;
  project?: ProjectSummary;
  onKill: (sessionId: string) => void;
  onViewProject: () => void;
}

export function ActiveSessionCard({ session, project, onKill, onViewProject }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [duration, setDuration] = useState(Date.now() - session.startedAt);
  const [killing, setKilling] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setDuration(Date.now() - session.startedAt), 1000);
    return () => clearInterval(id);
  }, [session.startedAt]);

  const handleKill = async () => {
    setKilling(true);
    await onKill(session.sessionId);
  };

  const totalTokens = project
    ? project.totalInputTokens + project.totalOutputTokens + project.totalCacheReadTokens + project.totalCacheCreationTokens
    : 0;

  return (
    <div className="bg-zinc-900 border border-emerald-500/20 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left hover:bg-zinc-800/40 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <span className="text-white font-medium text-sm truncate">{session.project}</span>
        <span className="ml-auto text-emerald-400 text-xs font-mono flex-shrink-0">{formatDuration(duration)}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3 space-y-3">

          {/* Project stats from matched project */}
          {project && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-zinc-800/60 rounded-lg px-2.5 py-2">
                <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-0.5">Cost</p>
                <p className="text-white text-sm font-bold">{formatCost(project.totalCostUSD)}</p>
              </div>
              <div className="bg-zinc-800/60 rounded-lg px-2.5 py-2">
                <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-0.5">Tokens</p>
                <p className="text-white text-sm font-bold">{formatTokens(totalTokens)}</p>
              </div>
              <div className="bg-zinc-800/60 rounded-lg px-2.5 py-2">
                <p className="text-zinc-500 text-[10px] uppercase tracking-wide mb-0.5">Sessions</p>
                <p className="text-white text-sm font-bold">{project.sessionCount}</p>
              </div>
            </div>
          )}

          {/* Models */}
          {project && project.models.length > 0 && (
            <div>
              <p className="text-zinc-600 text-[10px] uppercase tracking-wide mb-1.5">Models used</p>
              <div className="flex flex-wrap gap-1">
                {project.models.map(m => (
                  <span key={m} className={`text-xs px-1.5 py-0.5 rounded-full ${modelBg(m)}`}>
                    {shortModelName(m)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Session meta */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-600">PID</span>
              <span className="text-zinc-300 font-mono">{session.pid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Started</span>
              <span className="text-zinc-300">{timeAgo(new Date(session.startedAt).toISOString())}</span>
            </div>
            <div className="col-span-2 flex justify-between">
              <span className="text-zinc-600">Directory</span>
              <span className="text-zinc-400 font-mono text-[10px] truncate ml-2 max-w-[200px]">{session.cwd}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-0.5">
            <button
              onClick={onViewProject}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors flex-1 justify-center"
            >
              <ExternalLink className="w-3 h-3" />
              View Project
            </button>
            <button
              onClick={handleKill}
              disabled={killing}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors flex-1 justify-center disabled:opacity-50"
            >
              <Square className="w-3 h-3" />
              {killing ? 'Stopping…' : 'Kill Session'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
