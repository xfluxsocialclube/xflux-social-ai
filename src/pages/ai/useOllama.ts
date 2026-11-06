import { useCallback, useEffect, useState } from 'react';
import { getModel, getUrl, listModels, ping, saveModel, saveUrl, supportsVision, type ConnState, type OllamaModel } from '../../services/ollama';

export interface OllamaCtx {
  url: string; state: ConnState; version: string; models: OllamaModel[];
  model: string; modelOk: boolean; vision: boolean | null; ready: boolean;
  changeUrl: (u: string) => Promise<void>; changeModel: (m: string) => void; refresh: () => Promise<void>;
}
export function useOllama(): OllamaCtx {
  const [url, setUrl] = useState(getUrl());
  const [state, setState] = useState<ConnState>('checking');
  const [version, setVersion] = useState('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [model, setModel] = useState(getModel());
  const [vision, setVision] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const target = getUrl();
    setUrl(target); setState('checking');
    try {
      const v = await ping(target);
      setModels(await listModels(target)); setVersion(v); setState('connected');
    } catch { setModels([]); setVersion(''); setState('offline'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const modelOk = state === 'connected' && models.some((m) => m.name === model);
  useEffect(() => {
    setVision(null);
    if (!modelOk) return;
    let alive = true;
    supportsVision(model, url).then((v) => alive && setVision(v)).catch(() => alive && setVision(false));
    return () => { alive = false; };
  }, [modelOk, model, url]);

  return {
    url, state, version, models, model, modelOk, vision, ready: modelOk, refresh,
    changeUrl: async (u) => { saveUrl(u); await refresh(); },
    changeModel: (m) => { saveModel(m); setModel(m); },
  };
}
