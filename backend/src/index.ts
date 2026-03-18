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
import { getActiveSessions } from './services/sessionReader';

const app = express();
const PORT = 3001;

app.use(cors({ origin: true })); // allow all origins (Tailscale IPs, localhost)
app.use(express.json());

app.use('/api/sessions', sessionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/config', configRouter);
app.use('/api/projects', projectsRouter);

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

chokidar.watch(SESSIONS_DIR, { ignoreInitial: false }).on('all', () => {
  broadcast({ type: 'sessions_update', data: getActiveSessions() });
});

wss.on('connection', (ws) => {
  // Send current sessions on connect
  ws.send(JSON.stringify({ type: 'sessions_update', data: getActiveSessions() }));
});

server.listen(PORT, () => {
  console.log(`Claude Dashboard backend running on http://localhost:${PORT}`);
});
