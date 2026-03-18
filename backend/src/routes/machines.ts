import { Router, Request, Response } from 'express';
import { getMachines, addMachine, removeMachine, setLocalMachineName } from '../services/machineManager';

const router = Router();

function isValidMachineUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (!['http:', 'https:'].includes(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  // Block localhost variants
  if (['localhost', '127.0.0.1', '::1', '0.0.0.0'].includes(h)) return false;
  // Block cloud metadata endpoints
  if (h === '169.254.169.254') return false;
  // Block private IP ranges (RFC 1918 + link-local)
  if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/.test(h)) return false;
  return true;
}

// GET /api/machines — list all machines with online status
router.get('/', async (_req: Request, res: Response) => {
  const machines = getMachines();
  const withStatus = await Promise.all(machines.map(async m => {
    if (m.url === 'local') return { ...m, online: true };
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(`${m.url}/api/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      return { ...m, online: r.ok };
    } catch {
      return { ...m, online: false };
    }
  }));
  res.json(withStatus);
});

// POST /api/machines — add remote machine { name, url }
router.post('/', (req: Request, res: Response) => {
  const { name, url } = req.body as { name: string; url: string };
  if (!name || !url) { res.status(400).json({ error: 'name and url are required' }); return; }
  if (!isValidMachineUrl(url)) {
    res.status(400).json({ error: 'Invalid machine URL. Must be http/https and not point to a private or reserved address.' });
    return;
  }
  const m = addMachine(name, url);
  res.status(201).json(m);
});

// DELETE /api/machines/:id
router.delete('/:id', (req: Request, res: Response) => {
  const id = String(req.params['id']);
  if (id === 'local') { res.status(400).json({ error: 'Cannot remove local machine' }); return; }
  removeMachine(id);
  res.json({ success: true });
});

// PATCH /api/machines/local/name — rename local machine
router.patch('/local/name', (req: Request, res: Response) => {
  const { name } = req.body as { name: string };
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  setLocalMachineName(name);
  res.json({ success: true });
});

export default router;
