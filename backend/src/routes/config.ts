import { Router, Request, Response } from 'express';
import { getConfig, updateConfig, DashboardConfig } from '../services/configManager';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const config = getConfig();
  res.json(config);
});

router.patch('/', (req: Request, res: Response) => {
  const { model, effortLevel, budget } = req.body as {
    model?: string;
    effortLevel?: string;
    budget?: DashboardConfig['budget'];
  };

  if (model === undefined && effortLevel === undefined && budget === undefined) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }

  const result = updateConfig({ model, effortLevel, budget });
  res.status(result.success ? 200 : 500).json(result);
});

export default router;
