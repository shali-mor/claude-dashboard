import { useState, useCallback, useEffect, useMemo } from 'react';
import { Activity, Settings } from 'lucide-react';
import { ProjectCard } from './components/ProjectCard';
import { ActiveSessionCard } from './components/ActiveSessionCard';
import { ProjectDetail } from './components/ProjectDetail';
import { GlobalStats } from './components/GlobalStats';
import { GlobalCostChart } from './components/GlobalCostChart';
import { ConfigPanel } from './components/ConfigPanel';
import { FilterBar, type Filters, DEFAULT_FILTERS } from './components/FilterBar';
import { CostForecast } from './components/CostForecast';
import { BudgetAlert } from './components/BudgetAlert';
import { useApi, useWebSocket } from './hooks/useApi';
import type { ActiveSession, ProjectSummary, ProjectDetail as ProjectDetailType, GlobalConfig, RemoteMachine } from './types';

type View = { type: 'overview' } | { type: 'config' } | { type: 'project'; id: string; machineId: string };

function applyFilters(projects: ProjectSummary[], filters: Filters): ProjectSummary[] {
  return projects.filter(p => {
    // Model filter — project must use at least one of the selected models
    if (filters.models.length > 0) {
      const match = filters.models.some(key => p.models.some(m => m.toLowerCase().includes(key)));
      if (!match) return false;
    }

    // Machine filter — project must belong to one of the selected machines
    if (filters.machineIds.length > 0) {
      if (!filters.machineIds.includes(p.machineId)) return false;
    }

    // Cost filter — use period cost when a date range is active, otherwise all-time
    if (filters.minCost > 0) {
      const cutoffDate = filters.lastDays !== null
        ? new Date(Date.now() - filters.lastDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null;
      const periodCost = cutoffDate
        ? p.byDay.filter(d => d.date >= cutoffDate).reduce((s, d) => s + d.costUSD, 0)
        : p.totalCostUSD;
      if (periodCost < filters.minCost) return false;
    }

    // Last-active time filter
    if (filters.lastDays !== null) {
      const cutoff = Date.now() - filters.lastDays * 24 * 60 * 60 * 1000;
      if (new Date(p.lastActiveAt).getTime() < cutoff) return false;
    }

    return true;
  });
}

export default function App() {
  const [view, setView] = useState<View>({ type: 'overview' });
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const { data: projects, loading: projectsLoading, refetch: refetchProjects } =
    useApi<ProjectSummary[]>('/api/projects', 60_000);
  const { data: config, refetch: refetchConfig } = useApi<GlobalConfig>('/api/config');
  const { data: machines, refetch: refetchMachines } = useApi<RemoteMachine[]>('/api/machines', 15_000);

  const projectId = view.type === 'project' ? view.id : null;
  const projectMachineId = view.type === 'project' ? view.machineId : '';
  const { data: projectDetail } = useApi<ProjectDetailType>(
    projectId ? `/api/projects/${projectId}?machineId=${projectMachineId}` : ''
  );

  useWebSocket<{ type: string; data: ActiveSession[] }>(
    useCallback(msg => {
      if (msg.type === 'sessions_update') setActiveSessions(msg.data);
    }, [])
  );

  useEffect(() => {
    fetch('/api/sessions/active').then(r => r.json()).then(setActiveSessions).catch(() => {});
  }, []);

  const filteredProjects = useMemo(
    () => applyFilters(projects ?? [], filters),
    [projects, filters]
  );

  const handleKill = async (sessionId: string) => {
    const session = activeSessions.find(s => s.sessionId === sessionId);
    const machineParam = session?.machineId ? `?machineId=${session.machineId}` : '';
    await fetch(`/api/sessions/${sessionId}/kill${machineParam}`, { method: 'POST' });
  };

  const handleSaveGlobalConfig = async (updates: { model?: string; effortLevel?: string; budget?: { dailyLimit?: number; monthlyLimit?: number } }) => {
    await fetch('/api/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    refetchConfig();
  };

  const activeSessionForProject = (project: ProjectSummary) =>
    activeSessions.find(s => s.cwd === project.cwd || s.project === project.name);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => setView({ type: 'overview' })}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Activity className="w-4 h-4 text-black" />
          </div>
          <span className="text-white font-semibold">Claude Dashboard</span>
        </button>

        <div className="flex items-center gap-3">
          {activeSessions.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeSessions.length} active
            </span>
          )}
          <button
            onClick={() => setView(v => v.type === 'config' ? { type: 'overview' } : { type: 'config' })}
            className={`p-2 rounded-lg transition-colors ${view.type === 'config' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">

        {/* Global Config */}
        {view.type === 'config' && config && (
          <div className="space-y-2">
            <h2 className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-4">Global Settings</h2>
            <ConfigPanel
              config={config}
              onSave={handleSaveGlobalConfig}
              machines={machines ?? undefined}
              onMachinesChange={refetchMachines}
            />
          </div>
        )}

        {/* Project Detail */}
        {view.type === 'project' && projectDetail && (
          <ProjectDetail
            project={projectDetail}
            machineId={projectMachineId}
            activeSession={activeSessionForProject(projectDetail)}
            onBack={() => setView({ type: 'overview' })}
            onKill={handleKill}
          />
        )}
        {view.type === 'project' && !projectDetail && (
          <div className="flex items-center justify-center h-40 text-zinc-600">Loading project…</div>
        )}

        {/* Overview */}
        {view.type === 'overview' && (
          <div className="space-y-5">

            {/* Budget alerts — shown above filters if limits set */}
            {projects && config && (config.budget?.dailyLimit || config.budget?.monthlyLimit) && (
              <BudgetAlert
                projects={projects}
                dailyLimit={config.budget?.dailyLimit}
                monthlyLimit={config.budget?.monthlyLimit}
              />
            )}

            {/* Filters — top of page, controls everything below */}
            {!projectsLoading && projects && (
              <FilterBar
                filters={filters}
                onChange={setFilters}
                totalCount={projects.length}
                filteredCount={filteredProjects.length}
                machines={machines ?? undefined}
              />
            )}

            {/* Global stats */}
            {projects && projects.length > 0 && (
              <GlobalStats projects={projects} filters={filters} filteredCount={filteredProjects.length} />
            )}

            {/* Cost forecast — full-width horizontal card */}
            {projects && projects.length > 0 && (
              <CostForecast projects={projects} />
            )}

            {/* Cost trend chart */}
            {filteredProjects.length > 0 && (
              <GlobalCostChart projects={filteredProjects} filters={filters} />
            )}


            {/* Active sessions */}
            {activeSessions.length > 0 && (() => {
              const filteredSessions = activeSessions.filter(s =>
                filters.machineIds.length === 0 || filters.machineIds.includes(s.machineId)
              );
              if (filteredSessions.length === 0) return null;
              return (
              <div>
                <h2 className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-3">Active Now</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredSessions.map(s => {
                    const matchedProject = projects?.find(
                      p => p.cwd === s.cwd || p.name === s.project
                    );
                    return (
                      <ActiveSessionCard
                        key={s.sessionId}
                        session={s}
                        project={matchedProject}
                        onKill={handleKill}
                        onViewProject={() => {
                          if (matchedProject) setView({ type: 'project', id: matchedProject.id, machineId: matchedProject.machineId });
                        }}
                      />
                    );
                  })}
                </div>
              </div>
              );
            })()}

            {/* Projects grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Projects</h2>
                <button onClick={refetchProjects} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">refresh</button>
              </div>

              {projectsLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-zinc-900 rounded-xl border border-zinc-800 h-48 animate-pulse" />
                  ))}
                </div>
              )}

              {!projectsLoading && (
                <>
                  {filteredProjects.length === 0 && (
                    <div className="text-center py-16 text-zinc-600">
                      <p className="text-sm">No projects match the current filters.</p>
                      <button
                        onClick={() => setFilters(DEFAULT_FILTERS)}
                        className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 underline transition-colors"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProjects.map(p => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        activeSession={activeSessionForProject(p)}
                        machineOnline={p.machineOnline}
                        onClick={() => setView({ type: 'project', id: p.id, machineId: p.machineId })}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
