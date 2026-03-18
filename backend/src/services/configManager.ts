import fs from 'fs';
import path from 'path';
import { ClaudeConfig, Plugin } from '../types';

const CLAUDE_DIR = path.join(process.env.HOME || '', '.claude');
const SETTINGS_PATH = path.join(CLAUDE_DIR, 'settings.json');
const PLUGINS_PATH = path.join(CLAUDE_DIR, 'plugins', 'installed_plugins.json');
const DASHBOARD_CONFIG_PATH = path.join(CLAUDE_DIR, 'dashboard-config.json');

interface RawSettings {
  model?: string;
  effortLevel?: string;
  hooks?: Record<string, unknown>;
  enabledPlugins?: string[];
  [key: string]: unknown;
}

interface RawPluginEntry {
  scope?: string;
  installPath?: string;
  version?: string;
  installedAt?: string;
  lastUpdated?: string;
  gitCommitSha?: string;
}

interface RawPluginsFile {
  version: number;
  plugins?: Record<string, RawPluginEntry[]>;
}

export interface DashboardConfig {
  budget?: {
    dailyLimit?: number;
    monthlyLimit?: number;
  };
}

function readDashboardConfig(): DashboardConfig {
  try {
    if (fs.existsSync(DASHBOARD_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(DASHBOARD_CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return {};
}

function writeDashboardConfig(config: DashboardConfig): void {
  fs.writeFileSync(DASHBOARD_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfig(): ClaudeConfig {
  let settings: RawSettings = {};
  let plugins: Plugin[] = [];

  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    } catch {}
  }

  if (fs.existsSync(PLUGINS_PATH)) {
    try {
      const raw: RawPluginsFile = JSON.parse(fs.readFileSync(PLUGINS_PATH, 'utf-8'));
      for (const [nameKey, entries] of Object.entries(raw.plugins || {})) {
        const entry = Array.isArray(entries) ? entries[0] : entries;
        if (!entry) continue;
        plugins.push({
          name: nameKey,
          scope: entry.scope || 'user',
          installPath: entry.installPath || '',
          version: entry.gitCommitSha || entry.version,
          installedAt: entry.installedAt || '',
          updatedAt: entry.lastUpdated,
        });
      }
    } catch {}
  }

  const dashConfig = readDashboardConfig();

  return {
    model: settings.model,
    effortLevel: settings.effortLevel,
    hooks: settings.hooks,
    plugins,
    budget: dashConfig.budget,
  };
}

export function updateConfig(updates: Partial<Pick<RawSettings, 'model' | 'effortLevel'>> & { budget?: DashboardConfig['budget'] }): { success: boolean; message: string } {
  try {
    // Update budget separately
    if (updates.budget !== undefined) {
      const dashConfig = readDashboardConfig();
      dashConfig.budget = updates.budget;
      writeDashboardConfig(dashConfig);
    }

    // Update Claude settings if needed
    const claudeUpdates = { model: updates.model, effortLevel: updates.effortLevel };
    const hasClaudeUpdates = claudeUpdates.model !== undefined || claudeUpdates.effortLevel !== undefined;

    if (hasClaudeUpdates) {
      if (!fs.existsSync(SETTINGS_PATH)) {
        return { success: false, message: 'settings.json not found' };
      }

      const settings: RawSettings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      if (updates.model !== undefined) settings.model = updates.model;
      if (updates.effortLevel !== undefined) settings.effortLevel = updates.effortLevel;

      const backupDir = path.join(CLAUDE_DIR, 'backups');
      if (fs.existsSync(backupDir)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(SETTINGS_PATH, path.join(backupDir, `settings-dashboard-${timestamp}.json`));
      }

      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    }

    return { success: true, message: 'Settings updated' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to update settings: ${msg}` };
  }
}
