import { Router, Request, Response } from 'express';
import { getAllProjects, getProjectById, getSessionMessages, invalidateCache } from '../services/projectAggregator';
import { getProjectConfig, updateProjectConfig } from '../services/projectConfig';
import { getMachines } from '../services/machineManager';

const router = Router();

// Cache last known projects per remote machine
const remoteProjectCache = new Map<string, Record<string, unknown>[]>();

async function fetchRemoteProjects(machineId: string, machineUrl: string, machineName: string) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`${machineUrl}/api/projects`, { signal: ctrl.signal });
    if (!r.ok) throw new Error('not ok');
    const projects = await r.json() as Record<string, unknown>[];
    const tagged = projects.map(p => ({ ...p, machineId, machineName, machineOnline: true }));
    remoteProjectCache.set(machineId, tagged);
    return tagged;
  } catch {
    // Return cached projects marked offline
    const cached = remoteProjectCache.get(machineId);
    if (cached) return cached.map(p => ({ ...p, machineOnline: false }));
    return [];
  }
}

router.get('/', async (_req: Request, res: Response) => {
  const machines = getMachines();
  const localMachine = machines.find(m => m.url === 'local')!;
  const remotes = machines.filter(m => m.url !== 'local');

  const [localProjects, ...remoteResults] = await Promise.all([
    getAllProjects().then(ps =>
      ps.map(({ sessions: _s, ...p }) => ({
        ...p,
        machineId: 'local',
        machineName: localMachine.name,
        machineOnline: true,
      }))
    ),
    ...remotes.map(m => fetchRemoteProjects(m.id, m.url, m.name)),
  ]);

  res.json([...localProjects, ...remoteResults.flat()]);
});

router.post('/refresh', (_req: Request, res: Response) => {
  invalidateCache();
  res.json({ success: true });
});

// GET /api/projects/:id?machineId=xxx
router.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const machineId = String(req.query['machineId'] || 'local');

  if (machineId === 'local') {
    const project = await getProjectById(id);
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    const machines = getMachines();
    const local = machines.find(m => m.url === 'local')!;
    res.json({ ...project, machineId: 'local', machineName: local.name });
    return;
  }

  // Proxy to remote machine
  const machines = getMachines();
  const machine = machines.find(m => m.id === machineId);
  if (!machine) { res.status(404).json({ error: 'Machine not found' }); return; }
  try {
    const r = await fetch(`${machine.url}/api/projects/${id}`);
    if (!r.ok) { res.status(r.status).json({ error: 'Remote error' }); return; }
    const data = await r.json() as Record<string, unknown>;
    res.json({ ...data, machineId: machine.id, machineName: machine.name });
  } catch {
    res.status(503).json({ error: 'Machine unreachable' });
  }
});

router.get('/:id/config', async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const machineId = String(req.query['machineId'] || 'local');
  if (machineId !== 'local') {
    const machines = getMachines();
    const machine = machines.find(m => m.id === machineId);
    if (!machine) { res.status(404).json({ error: 'Machine not found' }); return; }
    try {
      const r = await fetch(`${machine.url}/api/projects/${id}/config`);
      res.status(r.status).json(await r.json());
    } catch { res.status(503).json({ error: 'Machine unreachable' }); }
    return;
  }
  const project = await getProjectById(id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json(getProjectConfig(project.cwd));
});

router.patch('/:id/config', async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const machineId = String(req.query['machineId'] || 'local');
  if (machineId !== 'local') {
    const machines = getMachines();
    const machine = machines.find(m => m.id === machineId);
    if (!machine) { res.status(404).json({ error: 'Machine not found' }); return; }
    try {
      const r = await fetch(`${machine.url}/api/projects/${id}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      res.status(r.status).json(await r.json());
    } catch { res.status(503).json({ error: 'Machine unreachable' }); }
    return;
  }
  const project = await getProjectById(id);
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  const { model, effortLevel } = req.body as { model?: string; effortLevel?: string };
  const result = updateProjectConfig(project.cwd, { model, effortLevel });
  res.status(result.success ? 200 : 500).json(result);
});

router.get('/:id/sessions/:sessionId/replay', async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const sessionId = String(req.params['sessionId']);
  const machineId = String(req.query['machineId'] || 'local');

  if (machineId !== 'local') {
    const machines = getMachines();
    const machine = machines.find(m => m.id === machineId);
    if (!machine) { res.status(404).json({ error: 'Machine not found' }); return; }
    try {
      const r = await fetch(`${machine.url}/api/projects/${id}/sessions/${sessionId}/replay`);
      res.status(r.status).json(await r.json());
    } catch { res.status(503).json({ error: 'Machine unreachable' }); }
    return;
  }
  const messages = await getSessionMessages(id, sessionId);
  if (!messages) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(messages);
});

export default router;
