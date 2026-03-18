# Claude Dashboard

A full-stack dashboard for monitoring your [Claude Code](https://claude.ai/code) usage — costs, active sessions, project breakdowns, monthly forecasts, and personalised cost-saving tips.

![Claude Dashboard](https://img.shields.io/badge/stack-React%20%2B%20Express-blue)

## Features

- **Project overview** — cost, tokens, sessions and last-active time per project
- **Cost trend chart** — stacked bar chart across all projects with per-project toggle
- **Active session monitor** — live cards via WebSocket, with kill-session support
- **Month forecast** — linear regression projection of end-of-month spend
- **Cost-saving tips** — project-specific suggestions with estimated monthly savings: model downgrades (full Sonnet switch or Opus-for-planning/Sonnet-for-execution hybrid), context trimming, Haiku routing — each with a copy-paste snippet
- **Session replay** — browse the full message history of any past session
- **Tool usage chart** — breakdown of tool calls per project
- **Budget alerts** — configurable daily/monthly spend limits with warning banners
- **Filter bar** — filter projects by model, machine, date range and minimum cost
- **Multi-machine aggregation** — add remote machines (via Tailscale or LAN); all projects and sessions aggregated into one view, with per-machine colour badges and offline detection
- **Remote access** — binds to `0.0.0.0`; works over [Tailscale](https://tailscale.com)

## Architecture

```
claude-dashboard/
├── backend/          # Express + TypeScript API server (port 3001)
│   └── src/
│       ├── routes/   # /api/projects, /api/sessions, /api/config, /api/machines
│       └── services/ # JSONL session parser, project aggregator, config manager, machine manager
└── frontend/         # React 19 + Vite + Tailwind + recharts (port 5173)
    └── src/
        ├── components/
        └── hooks/
```

The backend reads Claude Code's session files from `~/.claude/` directly — no agent or plugin required. A [chokidar](https://github.com/paulmillr/chokidar) watcher broadcasts live session updates over WebSocket.

## Requirements

- Node.js 18+
- [Claude Code](https://claude.ai/code) installed and has been used (session files in `~/.claude/`)

## Getting started

```bash
git clone https://github.com/shali-mor/claude-dashboard.git
cd claude-dashboard
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Remote access (Tailscale)

Both servers bind to `0.0.0.0`. If you have [Tailscale](https://tailscale.com) running, open the dashboard from any device on your tailnet:

```
http://<your-tailscale-ip>:5173
```

## Multi-machine setup

If you use Claude Code on multiple computers under the same account, you can aggregate all their data into one dashboard:

1. Install and run the dashboard backend on each machine (`npm run dev` or `cd backend && npm run dev`)
2. Connect each machine to the same Tailscale tailnet
3. In the dashboard go to **Settings → Remote Machines → Add Machine**, enter a name and the machine's Tailscale URL (e.g. `http://100.x.x.x:3001`)

Remote machine projects appear with a coloured badge. If a machine goes offline its last-known projects remain visible, grayed out with an **offline** indicator.

Machine configuration is stored in `~/.claude/dashboard-config.json`.

## Configuration

Global settings (model, effort level, budget limits) are saved to `~/.claude/settings.json` and `~/.claude/dashboard-config.json`. Per-project settings are written to `<project>/.claude/settings.json`.

Budget limits can be set in the **Settings** panel (⚙ top right). Alerts appear when daily or monthly spend crosses 70% and 100% of the configured limit.
