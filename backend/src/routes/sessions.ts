import { Router, Request, Response } from 'express';
import { getActiveSessions, getSessionHistory, getSessionById, killSession } from '../services/sessionReader';
import { getMachines } from '../services/machineManager';

const router = Router();

router.get('/active', async (_req: Request, res: Response) => {
  const machines = getMachines();
  const localMachine = machines.find(m => m.url === 'local')!;
  const remotes = machines.filter(m => m.url !== 'local');

  const localSessions = getActiveSessions().map(s => ({
    ...s,
    machineId: 'local',
    machineName: localMachine.name,
  }));

  const remoteSessions = await Promise.all(remotes.map(async m => {
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${m.url}/api/sessions/active`, { signal: ctrl.signal });
      if (!r.ok) return [];
      const sessions = await r.json() as Record<string, unknown>[];
      return sessions.map(s => ({ ...s, machineId: m.id, machineName: m.name }));
    } catch { return []; }
  }));

  res.json([...localSessions, ...remoteSessions.flat()]);
});

router.get('/history', async (req: Request, res: Response) => {
  const rawLimit = req.query.limit;
  const limitStr = Array.isArray(rawLimit) ? String(rawLimit[0]) : String(rawLimit ?? '50');
  const limit = Math.min(parseInt(limitStr, 10), 200);
  const sessions = await getSessionHistory(limit);
  res.json(sessions);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const session = await getSessionById(id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(session);
});

router.post('/:id/kill', (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const machineId = String(req.query['machineId'] || 'local');

  if (machineId !== 'local') {
    const machines = getMachines();
    const machine = machines.find(m => m.id === machineId);
    if (!machine) { res.status(404).json({ error: 'Machine not found' }); return; }
    fetch(`${machine.url}/api/sessions/${id}/kill`, { method: 'POST' })
      .then(r => r.json())
      .then(data => res.json(data))
      .catch(() => res.status(503).json({ error: 'Machine unreachable' }));
    return;
  }

  const activeSessions = getActiveSessions();
  const session = activeSessions.find(s => s.sessionId === id);
  if (!session) { res.status(404).json({ error: 'Active session not found' }); return; }
  const result = killSession(session.pid);
  res.status(result.success ? 200 : 500).json(result);
});

export default router;
