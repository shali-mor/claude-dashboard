import type { ProjectSummary, ActiveSession } from '../types';
import { formatCost, formatTokens, shortModelName, modelBg, timeAgo } from '../utils/format';
import { Activity, MessageSquare, Cpu, ChevronRight } from 'lucide-react';

interface Props {
  project: ProjectSummary;
  activeSession?: ActiveSession;
  onClick: () => void;
}

function costTier(cost: number): string {
  if (cost >= 100) return 'border-red-500/30 hover:border-red-500/60';
  if (cost >= 20) return 'border-amber-500/30 hover:border-amber-500/60';
  if (cost >= 5) return 'border-blue-500/30 hover:border-blue-500/60';
  return 'border-zinc-700/50 hover:border-zinc-600';
}

function costDot(cost: number): string {
  if (cost >= 100) return 'bg-red-400';
  if (cost >= 20) return 'bg-amber-400';
  if (cost >= 5) return 'bg-blue-400';
  return 'bg-zinc-500';
}

export function ProjectCard({ project, activeSession, onClick }: Props) {
  const totalTokens = project.totalInputTokens + project.totalOutputTokens +
    project.totalCacheReadTokens + project.totalCacheCreationTokens;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-zinc-900 rounded-xl border p-5 transition-all cursor-pointer group ${costTier(project.totalCostUSD)}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${activeSession ? 'bg-emerald-400 animate-pulse' : costDot(project.totalCostUSD)}`} />
          <span className="text-white font-semibold text-sm truncate">{project.name}</span>
          {activeSession && (
            <span className="flex-shrink-0 text-xs bg-emerald-400/10 text-emerald-400 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Activity className="w-2.5 h-2.5" /> live
            </span>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0 mt-0.5" />
      </div>

      {/* Cost — primary metric */}
      <div className="mb-4">
        <p className="text-2xl font-bold text-white">{formatCost(project.totalCostUSD)}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{formatTokens(totalTokens)} tokens total</p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 mb-3">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {project.sessionCount} sessions
        </span>
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3" />
          {project.messageCount.toLocaleString()} msgs
        </span>
      </div>

      {/* Models + last active */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {project.models.slice(0, 3).map(m => (
            <span key={m} className={`text-xs px-1.5 py-0.5 rounded-full ${modelBg(m)}`}>
              {shortModelName(m)}
            </span>
          ))}
        </div>
        <span className="text-xs text-zinc-600">{timeAgo(project.lastActiveAt)}</span>
      </div>
    </button>
  );
}
