import { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, GitBranch, Bot, Wrench, MessageSquare, Settings2, RefreshCw, Play, Monitor } from 'lucide-react';
import type { ProjectDetail as ProjectDetailType, ProjectConfig, ActiveSession } from '../types';
import { formatCost, formatDate, formatDuration, formatTokens, shortModelName, modelBg, timeAgo } from '../utils/format';
import { ProjectDailyChart } from './ProjectDailyChart';
import { ToolUsageChart } from './ToolUsageChart';
import { SessionReplay } from './SessionReplay';
import { useApi } from '../hooks/useApi';

type ChartMetric = 'cost' | 'sessions' | 'messages';

interface Props {
  project: ProjectDetailType;
  machineId: string;
  activeSession?: ActiveSession;
  onBack: () => void;
  onKill: (sessionId: string) => Promise<void>;
}

const MODELS = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
const EFFORT_LEVELS = ['low', 'medium', 'high'];

export function ProjectDetail({ project, machineId, activeSession, onBack, onKill }: Props) {
  const [metric, setMetric] = useState<ChartMetric>('cost');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [killConfirm, setKillConfirm] = useState(false);
  const [replaySession, setReplaySession] = useState<string | null>(null);

  const { data: config, refetch: refetchConfig } = useApi<ProjectConfig>(`/api/projects/${project.id}/config?machineId=${machineId}`);
  const [model, setModel] = useState('');
  const [effortLevel, setEffortLevel] = useState('');

  // Sync form state when config loads
  if (config && model === '' && effortLevel === '') {
    if (config.model) setModel(config.model);
    if (config.effortLevel) setEffortLevel(config.effortLevel);
  }

  const totalTokens = project.totalInputTokens + project.totalOutputTokens + project.totalCacheReadTokens + project.totalCacheCreationTokens;

  const handleSaveConfig = async () => {
    setSaving(true);
    await fetch(`/api/projects/${project.id}/config?machineId=${machineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || undefined, effortLevel: effortLevel || undefined }),
    });
    setSaving(false);
    setSaved(true);
    refetchConfig();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleKill = async () => {
    if (!activeSession) return;
    if (!killConfirm) { setKillConfirm(true); setTimeout(() => setKillConfirm(false), 3000); return; }
    setKillConfirm(false);
    await onKill(activeSession.sessionId);
  };

  return (
    <div className="space-y-5">
      {replaySession && (
        <SessionReplay
          projectId={project.id}
          sessionId={replaySession}
          onClose={() => setReplaySession(null)}
        />
      )}
      {/* Back + header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> All projects
        </button>
        {activeSession && (
          <button
            onClick={handleKill}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              killConfirm ? 'border-red-500 text-red-400 bg-red-500/10' : 'border-zinc-700 text-zinc-400 hover:border-red-500/50 hover:text-red-400'
            }`}
          >
            {killConfirm ? 'Confirm kill?' : '⬛ Kill session'}
          </button>
        )}
      </div>

      {/* Project title */}
      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <h2 className="text-xl font-bold text-white">{project.name}</h2>
          {activeSession && (
            <span className="text-xs bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> active
            </span>
          )}
          {project.machineName && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
              <Monitor className="w-2.5 h-2.5" />
              {project.machineName}
            </span>
          )}
        </div>
        <p className="text-zinc-600 text-xs font-mono">{project.cwd}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total cost', value: formatCost(project.totalCostUSD), accent: 'text-emerald-400' },
          { label: 'Tokens', value: formatTokens(totalTokens), accent: 'text-blue-400' },
          { label: 'Sessions', value: String(project.sessionCount), accent: 'text-violet-400' },
          { label: 'Last active', value: timeAgo(project.lastActiveAt), accent: 'text-amber-400' },
        ].map(c => (
          <div key={c.label} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3.5">
            <p className="text-zinc-500 text-xs mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tab toggle: Chart | Config */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {[{ id: false, label: 'Activity' }, { id: true, label: 'Config' }].map(t => (
          <button
            key={String(t.id)}
            onClick={() => setConfigTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
              configTab === t.id ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!configTab ? (
        <>
          {/* Daily chart */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-sm">Daily Breakdown</h3>
              <div className="flex gap-1">
                {(['cost', 'sessions', 'messages'] as ChartMetric[]).map(m => (
                  <button key={m} onClick={() => setMetric(m)}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${metric === m ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <ProjectDailyChart days={project.byDay} metric={metric} />
          </div>

          {/* Models used */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <h3 className="text-white font-medium text-sm mb-3">Models Used</h3>
            <div className="flex gap-2 flex-wrap">
              {project.models.map(m => (
                <span key={m} className={`text-sm px-3 py-1 rounded-full ${modelBg(m)}`}>{shortModelName(m)}<span className="ml-1.5 opacity-60 text-xs">{m}</span></span>
              ))}
              {project.models.length === 0 && <span className="text-zinc-600 text-sm">No model data</span>}
            </div>
          </div>

          {/* Tool usage */}
          {Object.keys(project.toolCounts ?? {}).length > 0 && (
            <ToolUsageChart project={project} />
          )}

          {/* Session list */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <h3 className="text-white font-medium text-sm mb-3">Sessions <span className="text-zinc-600 font-normal">({project.sessions.length})</span></h3>
            <div className="space-y-2">
              {project.sessions.map(s => (
                <div key={s.sessionId} className="border border-zinc-800 rounded-lg overflow-hidden">
                  <div
                    className="w-full px-3 py-2.5 grid items-center gap-2"
                    style={{ gridTemplateColumns: '68px 1fr 72px 72px 28px 20px' }}
                  >
                    <span className={`text-xs px-1.5 py-0.5 rounded text-center ${modelBg(s.model)}`}>{shortModelName(s.model)}</span>
                    <button
                      className="text-zinc-400 text-xs truncate text-left hover:text-zinc-200 transition-colors"
                      onClick={() => setExpanded(expanded === s.sessionId ? null : s.sessionId)}
                    >{formatDate(s.startedAt)}</button>
                    <span className="text-emerald-400 text-xs font-medium text-right">{formatCost(s.costUSD)}</span>
                    <span className="text-zinc-500 text-xs text-right">{s.durationMs > 0 ? formatDuration(s.durationMs) : '—'}</span>
                    <button
                      onClick={() => setReplaySession(s.sessionId)}
                      title="Replay session"
                      className="flex justify-center text-zinc-600 hover:text-violet-400 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setExpanded(expanded === s.sessionId ? null : s.sessionId)}
                      className="flex justify-center"
                    >
                      {expanded === s.sessionId ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
                    </button>
                  </div>
                  {expanded === s.sessionId && (
                    <div className="px-3 pb-3 pt-0 border-t border-zinc-800/50 space-y-2">
                      <div className="grid grid-cols-4 gap-2 pt-2">
                        {[
                          { icon: MessageSquare, label: 'Messages', value: s.messageCount },
                          { icon: Wrench, label: 'Tools', value: s.toolCallCount },
                          { icon: Bot, label: 'Agents', value: s.subagentCount },
                          { icon: GitBranch, label: 'Branch', value: s.gitBranch || '—' },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="bg-zinc-800/50 rounded p-2">
                            <div className="flex items-center gap-1 mb-0.5">
                              <Icon className="w-3 h-3 text-zinc-500" />
                              <span className="text-zinc-500 text-xs">{label}</span>
                            </div>
                            <p className="text-white text-xs font-medium">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {[
                          ['Input', formatTokens(s.inputTokens)],
                          ['Output', formatTokens(s.outputTokens)],
                          ['Cache read', formatTokens(s.cacheReadTokens)],
                          ['Cache write', formatTokens(s.cacheCreationTokens)],
                        ].map(([label, value]) => (
                          <div key={label} className="flex justify-between bg-zinc-800/50 rounded px-2 py-1">
                            <span className="text-zinc-600">{label}</span>
                            <span className="text-zinc-300 font-mono">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Config panel */
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-zinc-400" />
            <h3 className="text-white font-medium">Project Configuration</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 text-xs mb-1.5">Default Model</label>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-zinc-500">
                <option value="">— inherit global —</option>
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 text-xs mb-1.5">Effort Level</label>
              <select value={effortLevel} onChange={e => setEffortLevel(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-zinc-500">
                <option value="">— inherit global —</option>
                {EFFORT_LEVELS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <button onClick={handleSaveConfig} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black text-sm font-medium rounded-lg hover:bg-emerald-400 disabled:opacity-40 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save to project'}
          </button>

          {config && config.allowedCommands.length > 0 && (
            <div>
              <p className="text-zinc-500 text-xs mb-2">Allowed commands ({config.allowedCommands.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {config.allowedCommands.map((cmd, i) => (
                  <p key={i} className="text-xs font-mono text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded">{cmd}</p>
                ))}
              </div>
            </div>
          )}

          {config && config.hooks.length > 0 && (
            <div>
              <p className="text-zinc-500 text-xs mb-2">Hooks ({config.hooks.length})</p>
              <div className="space-y-1">
                {config.hooks.map((h, i) => (
                  <div key={i} className="text-xs bg-zinc-800/50 rounded px-2 py-1.5">
                    <span className="text-amber-400">{h.event}</span>
                    <span className="text-zinc-600 mx-1">›</span>
                    <span className="text-zinc-500">{h.matcher}</span>
                    <span className="text-zinc-600 mx-1">›</span>
                    <span className="font-mono text-zinc-400 truncate">{h.command.slice(0, 60)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
