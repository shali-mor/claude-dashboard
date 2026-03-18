import { format, parseISO } from 'date-fns';

export function formatCost(usd: number): string {
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMM d, yyyy HH:mm');
  } catch {
    try { return format(new Date(iso), 'MMM d, HH:mm'); } catch { return iso; }
  }
}

export function formatDateShort(iso: string): string {
  if (!iso) return '—';
  try { return format(parseISO(iso), 'MMM d'); } catch { return iso; }
}

export function shortModelName(model: string): string {
  if (!model || model === 'unknown') return '?';
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model.split('-')[1] || model;
}

export function modelColor(model: string): string {
  if (model.includes('opus')) return 'text-violet-400';
  if (model.includes('sonnet')) return 'text-blue-400';
  if (model.includes('haiku')) return 'text-emerald-400';
  return 'text-zinc-400';
}

export function modelBg(model: string): string {
  if (model.includes('opus')) return 'bg-violet-500/10 text-violet-300';
  if (model.includes('sonnet')) return 'bg-blue-500/10 text-blue-300';
  if (model.includes('haiku')) return 'bg-emerald-500/10 text-emerald-300';
  return 'bg-zinc-800 text-zinc-400';
}

export function timeAgo(iso: string): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
