import { useEffect, useRef, useState } from 'react';
import type { Dataset } from './filter';
import type { SearchQuery } from './search';
export function useSearch(data: Dataset | undefined, query: SearchQuery) {
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const [response, setResponse] = useState<{ requestId: number; indices: number[]; excluded: number; query: SearchQuery; data: Dataset }>();
  const [error, setError] = useState('');
  const sent = useRef<{ requestId: number; query: SearchQuery } | undefined>(undefined);
  useEffect(() => {
    if (!data) return;
    let instance: Worker;
    try { instance = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' }); }
    catch { setError('查询线程启动失败，请刷新页面重试。'); return; }
    worker.current = instance;
    setError('');
    instance.onmessage = event => {
      if (event.data.requestId === requestId.current && sent.current?.requestId === event.data.requestId) {
        setResponse({ ...event.data, query: sent.current!.query, data });
      }
    };
    instance.onerror = () => setError('查询线程运行失败，请刷新页面重试。');
    instance.postMessage({ rows: data.rows });
    return () => { instance.terminate(); worker.current = null; requestId.current++; };
  }, [data]);
  useEffect(() => {
    if (!data || !worker.current) return;
    const id = ++requestId.current;
    // Coalesce typing so obsolete searches do not queue up in the worker.
    const timer = window.setTimeout(() => {
      sent.current = { requestId: id, query };
      worker.current?.postMessage({ query, requestId: id });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [data, query]);
  const pending = !!data && (response?.query !== query || response?.data !== data);
  return { response, pending, error };
}
