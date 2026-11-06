import { useCallback, useEffect, useState } from 'react';
import { GUIDE_STEPS, guideStatus, loadGuide, saveGuide, type GuideState, type GuideStatus } from '../services/planner/guide';

export function useGuide() {
  const [status, setStatus] = useState<GuideStatus | null>(null);
  const [state, setState] = useState<GuideState>(() => loadGuide());
  const refresh = useCallback(() => { guideStatus().then(setStatus).catch(() => setStatus(null)); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const update = (g: GuideState) => { setState(g); saveGuide(g); };
  const doneCount = status ? status.done.filter(Boolean).length : 0;
  const firstOpen = status ? status.done.findIndex((d) => !d) : -1;
  return { status, state, update, refresh, doneCount, firstOpen: firstOpen < 0 ? GUIDE_STEPS - 1 : firstOpen, total: GUIDE_STEPS };
}
