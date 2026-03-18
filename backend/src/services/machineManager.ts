import os from 'os';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface Machine {
  id: string;       // 'local' for this machine, UUID for remotes
  name: string;     // display name, defaults to hostname for local
  url: string;      // 'local' for this machine, 'http://ip:3001' for remotes
}

const CONFIG_PATH = path.join(process.env.HOME || '', '.claude', 'dashboard-config.json');

function readConfig(): Record<string, unknown> {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
function writeConfig(data: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

export function getLocalMachine(): Machine {
  const cfg = readConfig();
  return { id: 'local', name: (cfg.localMachineName as string) || os.hostname(), url: 'local' };
}

export function getMachines(): Machine[] {
  const cfg = readConfig();
  return [getLocalMachine(), ...((cfg.machines as Machine[]) || [])];
}

export function addMachine(name: string, url: string): Machine {
  const cfg = readConfig();
  const m: Machine = { id: randomUUID(), name, url: url.replace(/\/$/, '') };
  cfg.machines = [...((cfg.machines as Machine[]) || []), m];
  writeConfig(cfg);
  return m;
}

export function removeMachine(id: string): void {
  const cfg = readConfig();
  cfg.machines = ((cfg.machines as Machine[]) || []).filter(m => m.id !== id);
  writeConfig(cfg);
}

export function setLocalMachineName(name: string): void {
  const cfg = readConfig();
  cfg.localMachineName = name;
  writeConfig(cfg);
}
