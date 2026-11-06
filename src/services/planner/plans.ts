/** Planos/ciclos e publicações planejadas (armazenamento local). Nada aqui publica em redes sociais. */
import { dbDelete, dbDeleteMany, dbGetAll, dbPut, dbPutMany } from '../db';
import { loadSetting, saveSetting } from '../settings';
import { listMedia, recordUsage } from '../library/library';
import type { MediaItem, UsageRecord } from '../library/types';
import { listCaptions, markCaptionUsed } from '../captions/store';
import { nowIso, uid } from '../captions/text';
import { NETWORKS } from '../networks';
import { listPairings } from './pairing';
import { addDays, diffDays, isValidTime, isValidYmd, todayYmd } from './dates';
import { newAttempt, withAttempt } from '../publishing/attempts';
import { generatePosts } from './schedule';
import type { CycleKind, Plan, PlanConfig, PlannedPost } from './types';

export const CYCLE_DAYS: Record<Exclude<CycleKind, 'custom'>, number> = { '1w': 7, '2w': 14, '3w': 21, '4w': 28 };
export const MAX_CUSTOM_DAYS = 120;
export const listPlans = () => dbGetAll<Plan>('plans');
export const listPosts = () => dbGetAll<PlannedPost>('posts');
export const endDateOf = (c: PlanConfig) => addDays(c.startDate, c.lengthDays - 1);

/* ---------- Configuração salva (localStorage) ---------- */
export const getPlanNetworks = () => loadSetting<string[]>('plan.networks', []);
export const setPlanNetworks = (ids: string[]) => saveSetting('plan.networks', ids);
export function defaultConfig(): PlanConfig {
  return {
    startDate: todayYmd(), cycleKind: '2w', lengthDays: 14, weekdays: [0, 1, 2, 3, 4, 5], times: ['09:00', '18:00'],
    networks: getPlanNetworks(), crossPost: true, captionMode: 'shared',
    mediaRepeatDays: loadSetting<number>('repeatDays', 30), captionReuseDays: loadSetting<number>('captionReuseDays', 0), allowUnpaired: false,
  };
}
/** As redes vêm sempre de 'plan.networks' (fonte única, também editada na página Redes sociais). */
export const loadConfig = (): PlanConfig => ({ ...defaultConfig(), ...loadSetting<Partial<PlanConfig>>('plan.config', {}), networks: getPlanNetworks() });
export const saveConfig = (c: PlanConfig) => saveSetting('plan.config', c);
export interface PlanFlags { schedule: boolean; cycle: boolean; }
export const loadFlags = () => loadSetting<PlanFlags>('plan.flags', { schedule: false, cycle: false });
export const saveFlags = (f: PlanFlags) => saveSetting('plan.flags', f);

export type ConfigProblem = 'noNetwork' | 'noWeekday' | 'noTime' | 'badTime' | 'badDate' | 'badLength' | 'dupTimes';
export function validateConfig(c: PlanConfig): ConfigProblem[] {
  const p: ConfigProblem[] = [];
  if (!c.networks.length) p.push('noNetwork'); if (!c.weekdays.length) p.push('noWeekday'); if (!c.times.length) p.push('noTime');
  if (c.times.some((t) => !isValidTime(t))) p.push('badTime'); else if (new Set(c.times).size !== c.times.length) p.push('dupTimes');
  if (!isValidYmd(c.startDate)) p.push('badDate');
  if (!Number.isInteger(c.lengthDays) || c.lengthDays < 1 || c.lengthDays > MAX_CUSTOM_DAYS) p.push('badLength');
  return p;
}

/* ---------- Dados de apoio à geração ---------- */
async function context() {
  const [pairings, captions, media, usage, posts] = await Promise.all([listPairings(), listCaptions(), listMedia(), dbGetAll<UsageRecord>('usage'), listPosts()]);
  return { pairings: pairings.filter((p) => p.status === 'confirmed'), captions, media, usage, posts };
}
function lastUses(usage: UsageRecord[], kept: PlannedPost[], captions: { id: string; usedAt: string[] }[]) {
  const mediaLast = new Map<string, string>(); const capLast = new Map<string, string>();
  const bump = (m: Map<string, string>, id: string, d: string) => { if (!m.get(id) || d > m.get(id)!) m.set(id, d); };
  usage.forEach((u) => bump(mediaLast, u.mediaId, u.at.slice(0, 10)));
  captions.forEach((c) => c.usedAt.forEach((d) => bump(capLast, c.id, d.slice(0, 10))));
  kept.forEach((p) => { if (p.status === 'skipped') return; if (p.mediaId) bump(mediaLast, p.mediaId, p.day); if (p.captionId) bump(capLast, p.captionId, p.day); });
  return { mediaLast, capLast };
}

/** Gera (ou regera) as publicações do plano. Publicadas e puladas nunca são apagadas. */
export async function buildPlanPosts(plan: Plan): Promise<PlannedPost[]> {
  const ctx = await context();
  const mine = ctx.posts.filter((p) => p.planId === plan.id);
  const today = todayYmd();
  const keep = mine.filter((p) => p.status === 'published' || p.status === 'skipped' || p.day < today);
  const drop = mine.filter((p) => !keep.includes(p)).map((p) => p.id);
  const others = ctx.posts.filter((p) => p.planId !== plan.id && p.status !== 'pending');
  const { mediaLast, capLast } = lastUses(ctx.usage, [...others, ...keep], ctx.captions);
  const fresh = generatePosts({
    planId: plan.id, config: plan.config, pairings: ctx.pairings, captions: new Map(ctx.captions.map((c) => [c.id, c])),
    allMediaIds: ctx.media.map((m) => m.id), mediaLastUse: mediaLast, captionLastUse: capLast,
    fromDate: today > plan.startDate ? today : plan.startDate,
    occupied: new Set(keep.map((p) => `${p.day}|${p.time}|${p.network}`)),
  });
  await dbDeleteMany('posts', drop); await dbPutMany('posts', fresh);
  return [...keep, ...fresh];
}

/* ---------- Ciclo de vida do plano ---------- */
export async function createDraft(config: PlanConfig, previousPlanId?: string): Promise<Plan> {
  const plans = await listPlans();
  for (const d of plans.filter((p) => p.status === 'draft')) { await dbDeleteMany('posts', (await listPosts()).filter((x) => x.planId === d.id).map((x) => x.id)); await dbDelete('plans', d.id); }
  const plan: Plan = { id: uid(), name: '', status: 'draft', config, startDate: config.startDate, endDate: endDateOf(config), createdAt: nowIso(), previousPlanId };
  await dbPut('plans', plan); await buildPlanPosts(plan); return plan;
}
export const savePlan = (p: Plan) => dbPut('plans', p);
export async function regenerate(plan: Plan, config: PlanConfig): Promise<Plan> {
  const next = { ...plan, config, startDate: config.startDate, endDate: endDateOf(config) };
  await savePlan(next); await buildPlanPosts(next); return next;
}
export type ActivateProblem = 'config' | 'noPosts' | 'unpaired' | 'alreadyActive';
export async function activationProblems(plan: Plan): Promise<ActivateProblem[]> {
  const [plans, posts] = await Promise.all([listPlans(), listPosts()]);
  const mine = posts.filter((p) => p.planId === plan.id); const out: ActivateProblem[] = [];
  if (validateConfig(plan.config).length) out.push('config');
  if (!mine.some((p) => p.status === 'scheduled')) out.push('noPosts');
  // Regra: só entra em calendário ativo conteúdo com associação confirmada, salvo escolha explícita do usuário.
  if (!plan.config.allowUnpaired && mine.some((p) => p.status === 'scheduled' && (!p.pairingId || p.unpaired))) out.push('unpaired');
  if (plans.some((p) => p.id !== plan.id && (p.status === 'active' || p.status === 'paused'))) out.push('alreadyActive');
  return out;
}
export async function activatePlan(plan: Plan): Promise<Plan> {
  const problems = await activationProblems(plan);
  if (problems.length) throw new Error(problems[0]);
  const next: Plan = { ...plan, status: 'active', activatedAt: nowIso() }; await savePlan(next); return next;
}
export const pausePlan = (p: Plan) => savePlan({ ...p, status: 'paused' });
export const resumePlan = (p: Plan) => savePlan({ ...p, status: 'active' });
export const finishPlan = (p: Plan) => savePlan({ ...p, status: 'finished', finishedAt: nowIso() });
export async function discardDraft(plan: Plan): Promise<void> {
  await dbDeleteMany('posts', (await listPosts()).filter((x) => x.planId === plan.id).map((x) => x.id)); await dbDelete('plans', plan.id);
}
/** "Continuar com as mesmas configurações": encerra o ciclo e cria o próximo, que só ativa sozinho se não faltar conteúdo. */
export async function continuePlan(prev: Plan): Promise<{ plan: Plan; pending: number }> {
  const today = todayYmd(); const start = addDays(prev.endDate, 1) > today ? addDays(prev.endDate, 1) : today;
  const config: PlanConfig = { ...prev.config, startDate: start };
  await finishPlan(prev);
  const draft = await createDraft(config, prev.id);
  const posts = (await listPosts()).filter((p) => p.planId === draft.id);
  const pending = posts.filter((p) => p.status === 'pending').length;
  if (pending === 0 && posts.length && !(await activationProblems(draft)).length) return { plan: await activatePlan(draft), pending };
  return { plan: draft, pending };
}

/* ---------- Ações sobre uma publicação ---------- */
/** O usuário confirma que publicou. Só isso conta como "publicado": o XFLUX não publica sozinho nesta fase. */
export async function confirmPublished(post: PlannedPost): Promise<PlannedPost> {
  const done: PlannedPost = { ...post, status: 'published', publishedAt: nowIso(), delivery: withAttempt(post.delivery, newAttempt({ mode: 'assisted', outcome: 'user-confirmed' }), { state: 'confirmed', confirmedBy: 'user', nextRetryAt: undefined }) };
  await dbPut('posts', done);
  const [media, captions] = await Promise.all([listMedia(), listCaptions()]);
  const m = media.find((x: MediaItem) => x.id === post.mediaId); const c = captions.find((x) => x.id === post.captionId);
  const net = NETWORKS.find((n) => n.id === post.network)?.name ?? post.network;
  if (m) await recordUsage(m, net, post.id); // alimenta a proteção contra repetição da Biblioteca
  if (c) await markCaptionUsed(c);
  return done;
}
export const skipPost = (p: PlannedPost) => dbPut('posts', { ...p, status: 'skipped' } satisfies PlannedPost);
export const restorePost = (p: PlannedPost) => dbPut('posts', { ...p, status: p.mediaId ? 'scheduled' : 'pending' } satisfies PlannedPost);
export const updatePostTime = (p: PlannedPost, time: string) => dbPut('posts', { ...p, time } satisfies PlannedPost);

/* ---------- Resumo do ciclo (Autopilot) ---------- */
export interface CycleSummary {
  total: number; published: number; skipped: number; pending: number; scheduled: number; overdue: number; remaining: number;
  progressPct: number; daysLeft: number; ended: boolean;
  perNetwork: { id: string; planned: number; published: number }[];
}
export function summarize(plan: Plan, posts: PlannedPost[], today = todayYmd()): CycleSummary {
  const mine = posts.filter((p) => p.planId === plan.id);
  const count = (s: PlannedPost['status']) => mine.filter((p) => p.status === s).length;
  const overdue = mine.filter((p) => p.status === 'scheduled' && p.day < today).length;
  const handled = count('published') + count('skipped');
  const daysLeft = diffDays(today, plan.endDate);
  const span = Math.max(1, diffDays(plan.startDate, plan.endDate) + 1);
  return {
    total: mine.length, published: count('published'), skipped: count('skipped'), pending: count('pending'), scheduled: count('scheduled'), overdue,
    remaining: mine.length - handled - count('pending'), progressPct: Math.min(100, Math.max(0, Math.round(((diffDays(plan.startDate, today) + 1) / span) * 100))),
    daysLeft, ended: daysLeft < 0,
    perNetwork: plan.config.networks.map((id) => ({ id, planned: mine.filter((p) => p.network === id && p.status !== 'pending').length, published: mine.filter((p) => p.network === id && p.status === 'published').length })),
  };
}
export const getAlertDays = () => loadSetting<number>('alertDays', 3);
