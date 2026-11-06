/** Estado do guia de configuração do FLUX. As etapas são concluídas pelos DADOS reais, não por cliques soltos. */
import { loadSetting, saveSetting } from '../settings';
import { listMedia } from '../library/library';
import { listCaptions } from '../captions/store';
import { listPairings } from './pairing';
import { getPlanNetworks, listPlans, listPosts, loadFlags, summarize, getAlertDays, type CycleSummary } from './plans';
import type { Plan } from './types';

export const GUIDE_STEPS = 8;
export interface GuideState { current: number; paused: boolean; }
export const loadGuide = () => loadSetting<GuideState>('guide', { current: 0, paused: false });
export const saveGuide = (g: GuideState) => saveSetting('guide', g);
export interface GuideStatus { done: boolean[]; counts: { media: number; captions: number; confirmed: number; networks: number; posts: number }; }

export async function guideStatus(): Promise<GuideStatus> {
  const [media, caps, pairs, plans, posts] = await Promise.all([listMedia(), listCaptions(), listPairings(), listPlans(), listPosts()]);
  const flags = loadFlags(); const open = plans.filter((p) => p.status !== 'finished');
  const confirmed = pairs.filter((p) => p.status === 'confirmed').length; const networks = getPlanNetworks().length;
  const planPosts = posts.filter((p) => open.some((pl) => pl.id === p.planId)).length;
  return {
    done: [media.length > 0, caps.length > 0, confirmed > 0, networks > 0, flags.schedule, flags.cycle, planPosts > 0, plans.some((p) => p.status === 'active' || p.status === 'paused')],
    counts: { media: media.length, captions: caps.length, confirmed, networks, posts: planPosts },
  };
}

export interface CycleAlert { plan: Plan; summary: CycleSummary; }
/** Alerta quando o ciclo ativo está perto do fim (padrão: 3 dias) ou já terminou. */
export async function cycleAlert(): Promise<CycleAlert | null> {
  const [plans, posts] = await Promise.all([listPlans(), listPosts()]);
  const plan = plans.find((p) => p.status === 'active'); if (!plan) return null;
  const summary = summarize(plan, posts);
  return summary.daysLeft <= getAlertDays() ? { plan, summary } : null;
}
