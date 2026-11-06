import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { CopyButton } from '../../components/CopyButton';
import { EmptyState } from '../../components/EmptyState';
import { MediaThumb } from '../../components/MediaThumb';
import { Modal } from '../../components/Modal';
import { NetTag } from '../../components/NetTag';
import { Notice } from '../../components/Notice';
import { PublishPanel } from '../../components/PublishPanel';
import { useI18n } from '../../i18n/I18nContext';
import { fmt } from '../../i18n/format';
import type { TranslationKey } from '../../i18n/pt';
import { listCaptions } from '../../services/captions/store';
import type { Caption } from '../../services/captions/types';
import { listMedia } from '../../services/library/library';
import type { MediaItem } from '../../services/library/types';
import { NETWORKS } from '../../services/networks';
import { addDays, isValidTime, monthGrid, parseYmd, startOfWeek, todayYmd } from '../../services/planner/dates';
import { activatePlan, activationProblems, createDraft, discardDraft, listPlans, listPosts, loadConfig, loadFlags, regenerate, restorePost, saveConfig, saveFlags, setPlanNetworks, skipPost, updatePostTime, validateConfig, type ActivateProblem } from '../../services/planner/plans';
import type { CaptionMode, Plan, PlanConfig, PlannedPost } from '../../services/planner/types';
import { confirmByUser } from '../../services/publishing/queue';
import type { PageId } from '../../config/nav';

type View = 'week' | 'month' | 'list';
const MAX_TIMES = 8;
const dayLabel = (t: (k: TranslationKey) => string, iso: string) => t(`days.${(parseYmd(iso).getDay() + 6) % 7}` as TranslationKey);

/* ---------------- Configuração ---------------- */
function ConfigForm({ onGenerated, onNavigate }: { onGenerated: () => void; onNavigate: (p: PageId) => void }) {
  const { t, locale } = useI18n();
  const [cfg, setCfg] = useState<PlanConfig>(() => loadConfig());
  const [saved, setSaved] = useState(false); const [errors, setErrors] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const [confirmGen, setConfirmGen] = useState(false); const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<PlanConfig>) => { setCfg({ ...cfg, ...p }); setSaved(false); };
  const toggleNet = (id: string) => { const nets = cfg.networks.includes(id) ? cfg.networks.filter((x) => x !== id) : [...cfg.networks, id]; setPlanNetworks(nets); set({ networks: nets }); };
  const check = () => { const p = validateConfig(cfg); setErrors(p); return p.length === 0; };
  const save = () => { if (!check()) return false; saveConfig(cfg); saveFlags({ ...loadFlags(), schedule: true }); setSaved(true); return true; };
  const generate = async () => {
    setConfirmGen(false); if (!save()) return; setBusy(true); setErr(null);
    try { await createDraft(cfg); onGenerated(); } catch { setErr(t('cb.err.save')); } finally { setBusy(false); }
  };
  const setTime = (i: number, v: string) => set({ times: cfg.times.map((x, k) => (k === i ? v : x)) });
  return (
    <div className="stack">
      {err && <Notice tone="warn">{err}</Notice>}
      <section className="card stack">
        <h2>{t('pl.cfg.networks')}</h2>
        <small className="muted">{t('pl.cfg.networksHint')}</small>
        <div className="chips">{NETWORKS.map((n) => { const on = cfg.networks.includes(n.id); return <button key={n.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleNet(n.id)}>{n.name}</button>; })}</div>
        <small className="muted">{t('pl.cfg.networksMore')} <button className="link" onClick={() => onNavigate('networks')}><u>{t('nav.networks')}</u></button></small>
      </section>
      <section className="card stack">
        <h2>{t('pl.cfg.days')}</h2>
        <div className="chips">{[0, 1, 2, 3, 4, 5, 6].map((d) => { const on = cfg.weekdays.includes(d); return <button key={d} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set({ weekdays: on ? cfg.weekdays.filter((x) => x !== d) : [...cfg.weekdays, d].sort() })}>{t(`days.${d}` as TranslationKey)}</button>; })}</div>
        <h2>{t('pl.cfg.times')}</h2>
        <small className="muted">{t('pl.cfg.timesHint')}</small>
        <div className="chips">
          {cfg.times.map((tm, i) => (
            <span className="row" key={i}><input type="time" value={tm} onChange={(e) => setTime(i, e.target.value)} aria-label={t('pl.cfg.times')} />
              {cfg.times.length > 1 && <button className="btn ghost small" onClick={() => set({ times: cfg.times.filter((_, k) => k !== i) })} aria-label={t('pr.remove')}>✕</button>}</span>
          ))}
          {cfg.times.length < MAX_TIMES && <button className="btn ghost small" onClick={() => set({ times: [...cfg.times, '12:00'] })}>{t('pl.cfg.addTime')}</button>}
        </div>
      </section>
      <section className="card stack">
        <h2>{t('pl.cfg.distribution')}</h2>
        <label className="switch-row"><input type="checkbox" checked={cfg.crossPost} onChange={(e) => set({ crossPost: e.target.checked })} /><span>{t('calc.cross')}<br /><small className="muted">{t('calc.crossHint')}</small></span></label>
        {cfg.crossPost && cfg.networks.length > 1 && (
          <label className="row">{t('calc.capMode')}:
            <select value={cfg.captionMode} onChange={(e) => set({ captionMode: e.target.value as CaptionMode })}><option value="shared">{t('calc.capShared')}</option><option value="perNetwork">{t('calc.capPer')}</option></select>
          </label>
        )}
        <h2>{t('pl.cfg.repeat')}</h2>
        <label className="row"><input type="number" min={0} max={365} value={cfg.mediaRepeatDays} onChange={(e) => set({ mediaRepeatDays: Math.max(0, Number(e.target.value) || 0) })} /> {t('pl.cfg.mediaDays')}</label>
        <label className="row"><input type="number" min={0} max={365} value={cfg.captionReuseDays} onChange={(e) => set({ captionReuseDays: Math.max(0, Number(e.target.value) || 0) })} /> {t('pl.cfg.captionDays')}</label>
        <label className="switch-row"><input type="checkbox" checked={cfg.allowUnpaired} onChange={(e) => set({ allowUnpaired: e.target.checked })} /><span>{t('pl.cfg.unpaired')}<br /><small className="warn-text">{t('pl.cfg.unpairedHint')}</small></span></label>
      </section>
      <section className="card stack">
        <small className="muted">{fmt(t('pl.cfg.cycleInfo'), { n: cfg.lengthDays, d: new Date(parseYmd(cfg.startDate)).toLocaleDateString(locale) })} <button className="link" onClick={() => onNavigate('autopilot')}><u>{t('nav.autopilot')}</u></button></small>
        {errors.length > 0 && <Notice tone="warn">{errors.map((e) => t(`pl.err.${e}` as TranslationKey)).join(' ')}</Notice>}
        {saved && <Notice>{t('pl.cfg.saved')}</Notice>}
        <div className="toolbar"><button className="btn ghost" onClick={save}>{t('pl.cfg.save')}</button><button className="btn" disabled={busy} onClick={() => setConfirmGen(true)}>{t('pl.cfg.generate')}</button></div>
      </section>
      {confirmGen && <ConfirmModal title={t('pl.cfg.generate')} text={t('pl.cfg.generateText')} confirmLabel={t('pl.cfg.generate')} onCancel={() => setConfirmGen(false)} onConfirm={generate} />}
    </div>
  );
}

/* ---------------- Calendário ---------------- */
export function PostDialog({ post, media, caption, onClose, onChanged, onNavigate }: { post: PlannedPost; media?: MediaItem; caption?: Caption; onClose: () => void; onChanged: () => void; onNavigate: (p: PageId) => void }) {
  const { t, locale } = useI18n();
  const [time, setTime] = useState(post.time); const [ask, setAsk] = useState(false); const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); onChanged(); onClose(); } catch { setErr(t('cb.err.save')); } };
  const overdue = post.status === 'scheduled' && post.day < todayYmd();
  return (
    <Modal title={`${new Date(parseYmd(post.day)).toLocaleDateString(locale)} · ${post.time}`} onClose={onClose}>
      <div className="stack">
        {err && <Notice tone="warn">{err}</Notice>}
        <div className="row"><NetTag id={post.network} />
          <span className={`pill ${post.status === 'published' ? 'ok' : post.status === 'pending' || overdue ? 'warn' : ''}`}>{t(`pl.st.${overdue ? 'overdue' : post.status}` as TranslationKey)}</span>
          {post.unpaired && <span className="pill warn">{t('pl.unpaired')}</span>}</div>
        {post.status === 'pending' ? (<>
          <Notice tone="warn">{t(`pl.why.${post.reason ?? 'noContent'}` as TranslationKey)}</Notice>
          <div className="row"><button className="btn ghost small" onClick={() => { onClose(); onNavigate('library'); }}>{t('nav.library')}</button><button className="btn ghost small" onClick={() => { onClose(); onNavigate('captions'); }}>{t('nav.captions')}</button><button className="btn ghost small" onClick={() => { onClose(); onNavigate('pairing'); }}>{t('nav.pairing')}</button></div>
        </>) : (<>
          <div className="row"><MediaThumb item={media} size={72} /><strong className="media-name">{media?.name ?? t('pr.missingMedia')}</strong></div>
          {!caption && <small className="warn-text">{post.unpaired ? t('pl.noCaption') : t('pr.missingCaption')}</small>}
          <Notice>{t('pl.assisted')}</Notice>
          {post.status === 'scheduled' && <label className="row">{t('pl.time')}: <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <button className="btn ghost small" disabled={!isValidTime(time) || time === post.time} onClick={() => run(() => updatePostTime(post, time))}>{t('cb.save')}</button></label>}
          <PublishPanel post={post} media={media} caption={caption} onChanged={onChanged} />
        </>)}
      </div>
      <div className="modal-actions">
        {post.status === 'skipped' && <button className="btn ghost" onClick={() => run(() => restorePost(post))}>{t('pl.restore')}</button>}
        {(post.status === 'scheduled' || post.status === 'pending') && <button className="btn ghost" onClick={() => run(() => skipPost(post))}>{t('pl.skip')}</button>}
        {post.status === 'scheduled' && <button className="btn" onClick={() => setAsk(true)}>{t('pl.markPublished')}</button>}
        <button className="btn ghost" onClick={onClose}>{t('lib.close')}</button>
      </div>
      {ask && <ConfirmModal title={t('pl.markPublished')} text={t('pl.markPublishedText')} confirmLabel={t('pl.markPublished')} onCancel={() => setAsk(false)} onConfirm={() => { setAsk(false); run(() => confirmByUser(post)); }} />}
    </Modal>
  );
}

function CalendarView({ onNavigate, onConfig }: { onNavigate: (p: PageId) => void; onConfig: () => void }) {
  const { t, locale } = useI18n();
  const [plans, setPlans] = useState<Plan[] | null>(null); const [posts, setPosts] = useState<PlannedPost[]>([]);
  const [media, setMedia] = useState<Map<string, MediaItem>>(new Map()); const [caps, setCaps] = useState<Map<string, Caption>>(new Map());
  const [view, setView] = useState<View>('week'); const [anchor, setAnchor] = useState(todayYmd()); const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<PlannedPost | null>(null); const [problems, setProblems] = useState<ActivateProblem[]>([]);
  const [ask, setAsk] = useState<'regen' | 'discard' | null>(null); const [err, setErr] = useState<string | null>(null); const [limit, setLimit] = useState(40);

  const refresh = useCallback(async () => {
    try {
      const [p, po, m, c] = await Promise.all([listPlans(), listPosts(), listMedia(), listCaptions()]);
      setPlans(p); setPosts(po); setMedia(new Map(m.map((x) => [x.id, x]))); setCaps(new Map(c.map((x) => [x.id, x])));
    } catch { setErr(t('cb.err.load')); setPlans([]); }
  }, [t]);
  useEffect(() => { refresh(); }, [refresh]);

  const plan = useMemo(() => { const l = plans ?? []; return l.find((p) => p.status === 'active' || p.status === 'paused') ?? l.find((p) => p.status === 'draft'); }, [plans]);
  useEffect(() => { if (plan && todayYmd() < plan.startDate) setAnchor(plan.startDate); else setAnchor(todayYmd()); }, [plan?.id]);
  const mine = useMemo(() => posts.filter((p) => plan && p.planId === plan.id).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time) || NETWORKS.findIndex((n) => n.id === a.network) - NETWORKS.findIndex((n) => n.id === b.network)), [posts, plan]);
  const byDay = useMemo(() => { const m = new Map<string, PlannedPost[]>(); mine.forEach((p) => m.set(p.day, [...(m.get(p.day) ?? []), p])); return m; }, [mine]);
  useEffect(() => { if (plan?.status === 'draft') activationProblems(plan).then(setProblems); else setProblems([]); }, [plan, posts]);

  if (plans === null) return <p className="muted">{t('lib.loading')}</p>;
  if (!plan) return (
    <div className="card stack"><EmptyState title={t('pl.emptyTitle')} description={t('pl.emptyDesc')} /><div className="center"><button className="btn" onClick={onConfig}>{t('pl.tab.config')}</button></div></div>
  );
  const today = todayYmd();
  const live = open ? posts.find((x) => x.id === open.id) ?? open : null; // sempre a versão mais recente da publicação aberta
  const cnt = (s: PlannedPost['status']) => mine.filter((p) => p.status === s).length;
  const overdue = mine.filter((p) => p.status === 'scheduled' && p.day < today).length;
  const pendingReasons = Array.from(new Set(mine.filter((p) => p.status === 'pending').map((p) => p.reason ?? 'noContent')));
  const act = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); await refresh(); } catch (e) { setErr(e instanceof Error && ['config', 'noPosts', 'unpaired', 'alreadyActive'].includes(e.message) ? t(`pl.prob.${e.message}` as TranslationKey) : t('cb.err.save')); } };
  const PostBtn = ({ p }: { p: PlannedPost }) => {
    const od = p.status === 'scheduled' && p.day < today; const m = p.mediaId ? media.get(p.mediaId) : undefined;
    return <button className={`post ${od ? 'overdue' : p.status}`} onClick={() => setOpen(p)}><span><strong>{p.time}</strong> <NetTag id={p.network} /></span><span className="media-name">{p.status === 'pending' ? t('pl.st.pending') : m?.name ?? '—'}</span></button>;
  };
  const weekStart = startOfWeek(anchor); const days7 = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const a = parseYmd(anchor); const grid = monthGrid(a.getFullYear(), a.getMonth());
  const upcoming = mine.filter((p) => p.day >= today && p.status !== 'skipped');
  const statusKey = plan.status === 'draft' ? 'pl.plan.draft' : plan.status === 'active' ? 'pl.plan.active' : plan.status === 'paused' ? 'pl.plan.paused' : 'pl.plan.finished';
  const range = `${new Date(parseYmd(plan.startDate)).toLocaleDateString(locale)} – ${new Date(parseYmd(plan.endDate)).toLocaleDateString(locale)}`;

  return (
    <div className="stack">
      {err && <Notice tone="warn">{err}</Notice>}
      <Notice>{t('pl.assisted')}</Notice>
      <section className="card stack">
        <div className="row between"><div className="row"><strong>{range}</strong><span className={`pill ${plan.status === 'active' ? 'ok' : 'warn'}`}>{t(statusKey as TranslationKey)}</span></div>
          <div className="row"><span className="pill">{fmt(t('pl.count.scheduled'), { n: cnt('scheduled') })}</span><span className="pill">{fmt(t('pl.count.published'), { n: cnt('published') })}</span><span className={`pill ${cnt('pending') ? 'warn' : ''}`}>{fmt(t('pl.count.pending'), { n: cnt('pending') })}</span></div></div>
        {pendingReasons.length > 0 && <Notice tone="warn">{pendingReasons.map((r) => t(`pl.why.${r}` as TranslationKey)).join(' ')}</Notice>}
        {overdue > 0 && <Notice tone="warn">{fmt(t('pl.overdue'), { n: overdue })}</Notice>}
        {plan.status === 'draft' && problems.length > 0 && <Notice tone="warn">{problems.map((p) => t(`pl.prob.${p}` as TranslationKey)).join(' ')}</Notice>}
        <div className="toolbar">
          {plan.status === 'draft' && <button className="btn" disabled={problems.length > 0} onClick={() => act(() => activatePlan(plan))}>{t('pl.activate')}</button>}
          <button className="btn ghost" onClick={() => setAsk('regen')}>{t('pl.regen')}</button>
          {plan.status === 'draft' && <button className="btn ghost" onClick={() => setAsk('discard')}>{t('pl.discard')}</button>}
          <button className="btn ghost" onClick={onConfig}>{t('pl.tab.config')}</button>
        </div>
      </section>
      <div className="tabs" role="tablist">{(['week', 'month', 'list'] as View[]).map((v) => <button key={v} role="tab" aria-selected={view === v} className={`tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{t(`pl.view.${v}` as TranslationKey)}</button>)}</div>

      {view === 'week' && (<>
        <div className="row between"><button className="btn ghost small" onClick={() => setAnchor(addDays(anchor, -7))}>{t('cb.prev')}</button><strong>{new Date(parseYmd(days7[0])).toLocaleDateString(locale)} – {new Date(parseYmd(days7[6])).toLocaleDateString(locale)}</strong><button className="btn ghost small" onClick={() => setAnchor(addDays(anchor, 7))}>{t('cb.next')}</button></div>
        <div className="week">{days7.map((d) => { const ps = byDay.get(d) ?? []; return (
          <div key={d} className={`day ${d === today ? 'today' : ''} ${ps.length === 0 ? 'off' : ''}`}>
            <div className="day-head"><span>{dayLabel(t, d)}</span><span>{d.slice(8)}/{d.slice(5, 7)}</span></div>
            {ps.map((p) => <PostBtn key={p.id} p={p} />)}
          </div>); })}</div>
      </>)}

      {view === 'month' && (<>
        <div className="row between"><button className="btn ghost small" onClick={() => setAnchor(addDays(grid[0][0], -1))}>{t('cb.prev')}</button><strong>{a.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</strong><button className="btn ghost small" onClick={() => setAnchor(addDays(grid[grid.length - 1][6], 1))}>{t('cb.next')}</button></div>
        <div className="month">{[0, 1, 2, 3, 4, 5, 6].map((i) => <small key={i} className="muted">{t(`days.${i}` as TranslationKey)}</small>)}
          {grid.flat().map((d) => { const ps = byDay.get(d) ?? []; const n = (s: PlannedPost['status']) => ps.filter((p) => p.status === s).length; return (
            <button key={d} className={`mday ${parseYmd(d).getMonth() !== a.getMonth() ? 'out' : ''} ${d === sel ? 'sel' : ''} ${d === today ? 'today' : ''}`} onClick={() => setSel(d)} aria-label={d}>
              <span>{Number(d.slice(8))}</span>
              <span className="dots">{n('scheduled') > 0 && <b className="s">{n('scheduled')}</b>}{n('pending') > 0 && <b className="p">{n('pending')}</b>}{n('published') > 0 && <b className="d">{n('published')}</b>}</span>
            </button>); })}</div>
        <small className="muted">{t('pl.legend')}</small>
        {sel && <div className="card stack"><strong>{new Date(parseYmd(sel)).toLocaleDateString(locale)}</strong>{(byDay.get(sel) ?? []).length === 0 ? <small className="muted">{t('pl.noPostsDay')}</small> : (byDay.get(sel) ?? []).map((p) => <PostBtn key={p.id} p={p} />)}</div>}
      </>)}

      {view === 'list' && (upcoming.length === 0 ? <div className="card"><EmptyState title={t('pl.noUpcoming')} description={t('pl.noUpcomingDesc')} /></div> : (
        <div className="card"><ul className="list">{upcoming.slice(0, limit).map((p) => { const m = p.mediaId ? media.get(p.mediaId) : undefined; return (
          <li key={p.id}><span className="row"><strong>{new Date(parseYmd(p.day)).toLocaleDateString(locale)} {p.time}</strong><NetTag id={p.network} /><span className="media-name">{p.status === 'pending' ? t('pl.st.pending') : m?.name ?? '—'}</span></span><button className="btn ghost small" onClick={() => setOpen(p)}>{t('pl.open')}</button></li>); })}</ul>
          {upcoming.length > limit && <div className="center"><button className="btn ghost small" onClick={() => setLimit(limit + 40)}>{t('pl.more')}</button></div>}</div>
      ))}

      {live && <PostDialog post={live} media={live.mediaId ? media.get(live.mediaId) : undefined} caption={live.captionId ? caps.get(live.captionId) : undefined} onClose={() => setOpen(null)} onChanged={refresh} onNavigate={onNavigate} />}
      {ask === 'regen' && <ConfirmModal title={t('pl.regen')} text={t('pl.regenText')} confirmLabel={t('pl.regen')} onCancel={() => setAsk(null)} onConfirm={() => { setAsk(null); act(async () => { const cfg = loadConfig(); await regenerate(plan, plan.status === 'draft' ? cfg : { ...cfg, startDate: plan.startDate, lengthDays: plan.config.lengthDays, cycleKind: plan.config.cycleKind }); }); }} />}
      {ask === 'discard' && <ConfirmModal title={t('pl.discard')} text={t('pl.discardText')} confirmLabel={t('pl.discard')} onCancel={() => setAsk(null)} onConfirm={() => { setAsk(null); act(() => discardDraft(plan)); }} />}
    </div>
  );
}

export function Planner({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { t } = useI18n(); const [tab, setTab] = useState<'calendar' | 'config'>('calendar'); const [ver, setVer] = useState(0);
  return (
    <div className="stack">
      <div className="tabs" role="tablist">{(['calendar', 'config'] as const).map((x) => <button key={x} role="tab" aria-selected={tab === x} className={`tab ${tab === x ? 'active' : ''}`} onClick={() => setTab(x)}>{t(`pl.tab.${x}` as TranslationKey)}</button>)}</div>
      {tab === 'calendar' ? <CalendarView key={ver} onNavigate={onNavigate} onConfig={() => setTab('config')} /> : <ConfigForm onGenerated={() => { setVer(ver + 1); setTab('calendar'); }} onNavigate={onNavigate} />}
    </div>
  );
}
