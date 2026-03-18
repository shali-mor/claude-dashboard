import { useState } from 'react';
import { Save, Puzzle, ChevronDown, DollarSign, Monitor, Lock, Trash2, Plus } from 'lucide-react';
import type { GlobalConfig, RemoteMachine } from '../types';
import { formatDate } from '../utils/format';

interface Props {
  config: GlobalConfig;
  onSave: (updates: { model?: string; effortLevel?: string; budget?: { dailyLimit?: number; monthlyLimit?: number } }) => Promise<void>;
  machines?: RemoteMachine[];
  onMachinesChange?: () => void;
}

const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

const EFFORT_LEVELS = ['low', 'medium', 'high'];

export function ConfigPanel({ config, onSave, machines, onMachinesChange }: Props) {
  const [model, setModel] = useState(config.model || '');
  const [effortLevel, setEffortLevel] = useState(config.effortLevel || '');
  const [dailyLimit, setDailyLimit] = useState(String(config.budget?.dailyLimit ?? ''));
  const [monthlyLimit, setMonthlyLimit] = useState(String(config.budget?.monthlyLimit ?? ''));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Remote machines state
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineUrl, setNewMachineUrl] = useState('');
  const [addingMachine, setAddingMachine] = useState(false);

  const handleAddMachine = async () => {
    if (!newMachineName.trim() || !newMachineUrl.trim()) return;
    setAddingMachine(true);
    try {
      await fetch('/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMachineName.trim(), url: newMachineUrl.trim() }),
      });
      setNewMachineName('');
      setNewMachineUrl('');
      onMachinesChange?.();
    } finally {
      setAddingMachine(false);
    }
  };

  const handleRemoveMachine = async (id: string) => {
    await fetch(`/api/machines/${id}`, { method: 'DELETE' });
    onMachinesChange?.();
  };

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

      {/* Remote Machines */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Monitor className="w-4 h-4 text-zinc-400" />
          <h3 className="text-white font-medium">Remote Machines</h3>
          {machines && (
            <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full">
              {machines.length}
            </span>
          )}
        </div>

        {/* Machine list */}
        <div className="space-y-2 mb-4">
          {(!machines || machines.length === 0) && (
            <p className="text-zinc-600 text-sm">No machines configured</p>
          )}
          {machines && machines.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Monitor className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm">{m.name}</p>
                    {m.id === 'local' && (
                      <Lock className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.online ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                    <span className={`text-xs ${m.online ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {m.online ? 'online' : 'offline'}
                    </span>
                  </div>
                  <p className="text-zinc-600 text-xs font-mono truncate">{m.url}</p>
                </div>
              </div>
              {m.id !== 'local' && (
                <button
                  onClick={() => handleRemoveMachine(m.id)}
                  className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                  title="Remove machine"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add machine form */}
        <div className="pt-3 border-t border-zinc-800">
          <p className="text-zinc-500 text-xs mb-2 uppercase tracking-wider">Add Machine</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              placeholder="Name (e.g. MacBook Pro)"
              value={newMachineName}
              onChange={e => setNewMachineName(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
            />
            <input
              type="text"
              placeholder="URL (e.g. http://100.x.x.x:3001)"
              value={newMachineUrl}
              onChange={e => setNewMachineUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddMachine(); }}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
            />
          </div>
          <button
            onClick={handleAddMachine}
            disabled={addingMachine || !newMachineName.trim() || !newMachineUrl.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            {addingMachine ? 'Adding…' : 'Add Machine'}
          </button>
        </div>
      </div>
    </div>
  );
}
