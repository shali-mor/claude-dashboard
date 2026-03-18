import { useState } from 'react';
import { Save, Puzzle, ChevronDown, DollarSign } from 'lucide-react';
import type { GlobalConfig } from '../types';
import { formatDate } from '../utils/format';

interface Props {
  config: GlobalConfig;
  onSave: (updates: { model?: string; effortLevel?: string; budget?: { dailyLimit?: number; monthlyLimit?: number } }) => Promise<void>;
}

const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

const EFFORT_LEVELS = ['low', 'medium', 'high'];

export function ConfigPanel({ config, onSave }: Props) {
  const [model, setModel] = useState(config.model || '');
  const [effortLevel, setEffortLevel] = useState(config.effortLevel || '');
  const [dailyLimit, setDailyLimit] = useState(String(config.budget?.dailyLimit ?? ''));
  const [monthlyLimit, setMonthlyLimit] = useState(String(config.budget?.monthlyLimit ?? ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const budget = (dailyLimit || monthlyLimit) ? {
      dailyLimit: dailyLimit ? Number(dailyLimit) : undefined,
      monthlyLimit: monthlyLimit ? Number(monthlyLimit) : undefined,
    } : undefined;
    await onSave({ model: model || undefined, effortLevel: effortLevel || undefined, budget });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isDirty =
    model !== (config.model || '') ||
    effortLevel !== (config.effortLevel || '') ||
    dailyLimit !== String(config.budget?.dailyLimit ?? '') ||
    monthlyLimit !== String(config.budget?.monthlyLimit ?? '');

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <h3 className="text-white font-medium mb-4">Global Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-zinc-500 text-xs mb-1.5">Default Model</label>
            <div className="relative">
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-zinc-500"
              >
                <option value="">— inherit —</option>
                {MODELS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-zinc-500 text-xs mb-1.5">Effort Level</label>
            <div className="relative">
              <select
                value={effortLevel}
                onChange={e => setEffortLevel(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white appearance-none focus:outline-none focus:border-zinc-500"
              >
                <option value="">— inherit —</option>
                {EFFORT_LEVELS.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
        {/* Budget limits */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Budget Alerts</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 text-xs mb-1.5">Daily Limit (USD)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 5"
                value={dailyLimit}
                onChange={e => setDailyLimit(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="block text-zinc-500 text-xs mb-1.5">Monthly Limit (USD)</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 50"
                value={monthlyLimit}
                onChange={e => setMonthlyLimit(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-medium disabled:opacity-40 hover:bg-emerald-400 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Puzzle className="w-4 h-4 text-zinc-400" />
          <h3 className="text-white font-medium">Installed Plugins</h3>
          <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
            {config.plugins.length}
          </span>
        </div>
        {config.plugins.length === 0 ? (
          <p className="text-zinc-600 text-sm">No plugins installed</p>
        ) : (
          <div className="space-y-2">
            {config.plugins.map(p => (
              <div key={p.name} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
                <div>
                  <p className="text-white text-sm">{p.name}</p>
                  <p className="text-zinc-600 text-xs">{p.scope} · installed {formatDate(p.installedAt)}</p>
                </div>
                {p.version && (
                  <span className="text-xs text-zinc-600 font-mono">{p.version.slice(0, 7)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
