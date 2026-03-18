import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import chokidar from 'chokidar';
import path from 'path';
import sessionsRouter from './routes/sessions';
import statsRouter from './routes/stats';
import configRouter from './routes/config';
import projectsRouter from './routes/projects';
import machinesRouter from './routes/machines';
import { getActiveSessions } from './services/sessionReader';
import { getMachines } from './services/machineManager';

const app = express();
const PORT = 3001;

app.use(cors({ origin: true })); // allow all origins (Tailscale IPs, localhost)
app.use(express.json());

app.use('/api/sessions', sessionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/config', configRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/machines', machinesRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Watch ~/.claude/sessions/ for real-time session updates
const SESSIONS_DIR = path.join(process.env.HOME || '', '.claude', 'sessions');

const broadcast = (data: unknown) => {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
};

async function getAllActiveSessions() {
  const machines = getMachines();
  const local = machines.find(m => m.url === 'local')!;
  const remotes = machines.filter(m => m.url !== 'local');

  const localSessions = getActiveSessions().map(s => ({
    ...s, machineId: 'local', machineName: local.name,
  }));

  const remoteSessions = await Promise.all(remotes.map(async m => {
    try {
      const r = await fetch(`${m.url}/api/sessions/active`);
      if (!r.ok) return [];
      const sessions = await r.json() as Record<string, unknown>[];
      return sessions.map(s => ({ ...s, machineId: m.id, machineName: m.name }));
    } catch { return []; }
  }));

  return [...localSessions, ...remoteSessions.flat()];
}

chokidar.watch(SESSIONS_DIR, { ignoreInitial: false }).on('all', async () => {
  broadcast({ type: 'sessions_update', data: await getAllActiveSessions() });
});

wss.on('connection', async (ws) => {
  ws.send(JSON.stringify({ type: 'sessions_update', data: await getAllActiveSessions() }));
});

server.listen(PORT, () => {
  console.log(`Claude Dashboard backend running on http://localhost:${PORT}`);
});
