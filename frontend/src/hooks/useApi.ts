import { useState, useEffect, useCallback } from 'react';

export function useApi<T>(url: string, intervalMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetch_();
    if (!intervalMs) return;
    const id = setInterval(fetch_, intervalMs);
    return () => clearInterval(id);
  }, [fetch_, intervalMs]);

  return { data, loading, error, refetch: fetch_ };
}

export function useWebSocket<T>(onMessage: (data: T) => void) {
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//localhost:3001`);

    ws.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch {}
    };

    ws.onerror = () => {};

    return () => ws.close();
  }, [onMessage]);
}
