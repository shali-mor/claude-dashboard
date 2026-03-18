import { Router, Request, Response } from 'express';
import { getAggregateStats } from '../services/statsParser';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const stats = getAggregateStats();
  res.json(stats);
});

export default router;
