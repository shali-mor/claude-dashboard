import fs from 'fs';
import path from 'path';

const CLAUDE_DIR = path.join(process.env.HOME || '', '.claude');

export interface ProjectConfig {
  model?: string;
  effortLevel?: string;
  allowedCommands: string[];
  hooks: { event: string; matcher: string; command: string }[];
}

function readJson(filePath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

function getSettingsPath(cwd: string): { local: string; global: string } {
  return {
    local: path.join(cwd, '.claude', 'settings.local.json'),
    global: path.join(cwd, '.claude', 'settings.json'),
  };
}

export function getProjectConfig(cwd: string): ProjectConfig {
  const { local, global: globalPath } = getSettingsPath(cwd);

  // Merge: project local > project global > user global
  const userGlobal = readJson(path.join(CLAUDE_DIR, 'settings.json'));
  const projGlobal = fs.existsSync(globalPath) ? readJson(globalPath) : {};
  const projLocal = fs.existsSync(local) ? readJson(local) : {};

  const merged = { ...userGlobal, ...projGlobal, ...projLocal };

  // Extract allowed commands from permissions
  const allowedCommands: string[] = [];
  const allow = (merged.permissions as { allow?: string[] })?.allow ?? (merged.allow as string[]) ?? [];
  if (Array.isArray(allow)) allowedCommands.push(...allow);

  // Extract hooks
  const hooks: ProjectConfig['hooks'] = [];
  const rawHooks = merged.hooks as Record<string, Array<{ matcher?: string; hooks?: Array<{ type: string; command: string }> }>> | undefined;
  if (rawHooks) {
    for (const [event, entries] of Object.entries(rawHooks)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        for (const h of entry.hooks || []) {
          if (h.type === 'command' && h.command) {
            hooks.push({ event, matcher: entry.matcher || '*', command: h.command });
          }
        }
      }
    }
  }

  return {
    model: (merged.model as string) || (userGlobal.model as string) || undefined,
    effortLevel: (merged.effortLevel as string) || (userGlobal.effortLevel as string) || undefined,
    allowedCommands,
    hooks,
  };
}

export function updateProjectConfig(cwd: string, updates: { model?: string; effortLevel?: string }): { success: boolean; message: string } {
  const { local } = getSettingsPath(cwd);
  const claudeDir = path.join(cwd, '.claude');

  try {
    if (!fs.existsSync(claudeDir)) fs.mkdirSync(claudeDir, { recursive: true });

    const existing = fs.existsSync(local) ? readJson(local) : {};
    if (updates.model !== undefined) existing.model = updates.model;
    if (updates.effortLevel !== undefined) existing.effortLevel = updates.effortLevel;

    fs.writeFileSync(local, JSON.stringify(existing, null, 2), 'utf-8');
    return { success: true, message: `Updated ${local}` };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}
