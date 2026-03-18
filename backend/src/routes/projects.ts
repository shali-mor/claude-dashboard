import { Router, Request, Response } from 'express';
import { getAllProjects, getProjectById, getSessionMessages, invalidateCache } from '../services/projectAggregator';
import { getProjectConfig, updateProjectConfig } from '../services/projectConfig';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const projects = await getAllProjects();
  const summary = projects.map(({ sessions: _s, ...p }) => p);
  res.json(summary);
});

router.post('/refresh', (_req: Request, res: Response) => {
  invalidateCache();
  res.json({ success: true });
});

router.get('/:id', async (req: Request, res: Response) => {
  const project = await getProjectById(String(req.params['id']));
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json(project);
});

router.get('/:id/config', async (req: Request, res: Response) => {
  const project = await getProjectById(String(req.params['id']));
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  res.json(getProjectConfig(project.cwd));
});

router.patch('/:id/config', async (req: Request, res: Response) => {
  const project = await getProjectById(String(req.params['id']));
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const { model, effortLevel } = req.body as { model?: string; effortLevel?: string };
  const result = updateProjectConfig(project.cwd, { model, effortLevel });
  res.status(result.success ? 200 : 500).json(result);
});

// GET /api/projects/:id/sessions/:sessionId/replay
router.get('/:id/sessions/:sessionId/replay', async (req: Request, res: Response) => {
  const messages = await getSessionMessages(String(req.params['id']), String(req.params['sessionId']));
  if (!messages) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json(messages);
});

export default router;
