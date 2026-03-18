import { Router, Request, Response } from 'express';
import { getActiveSessions, getSessionHistory, getSessionById, killSession } from '../services/sessionReader';

const router = Router();

router.get('/active', async (_req: Request, res: Response) => {
  const sessions = getActiveSessions();
  res.json(sessions);
});

router.get('/history', async (req: Request, res: Response) => {
  const rawLimit = req.query.limit;
  const limitStr = Array.isArray(rawLimit) ? String(rawLimit[0]) : typeof rawLimit === 'object' ? '50' : String(rawLimit ?? '50');
  const limit = Math.min(parseInt(limitStr, 10), 200);
  const sessions = await getSessionHistory(limit);
  res.json(sessions);
});

router.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const session = await getSessionById(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

router.post('/:id/kill', (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const activeSessions = getActiveSessions();
  const session = activeSessions.find(s => s.sessionId === id);

  if (!session) {
    res.status(404).json({ error: 'Active session not found' });
    return;
  }

  const result = killSession(session.pid);
  res.status(result.success ? 200 : 500).json(result);
});

export default router;
