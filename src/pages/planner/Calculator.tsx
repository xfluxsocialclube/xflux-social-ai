import { useEffect, useMemo, useState } from 'react';
import { Notice } from '../../components/Notice';
import { useI18n } from '../../i18n/I18nContext';
import { fmt } from '../../i18n/format';
import { dbGetAll } from '../../services/db';
import { isAvailable, listCaptions } from '../../services/captions/store';
import type { Caption } from '../../services/captions/types';
import { listMedia } from '../../services/library/library';
import type { MediaItem, UsageRecord } from '../../services/library/types';
import { calculate, type CalcInput } from '../../services/planner/calculator';
import { listPairings } from '../../services/planner/pairing';
import { loadConfig } from '../../services/planner/plans';
import type { CaptionMode } from '../../services/planner/types';

const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));

export function Calculator() {
  const { t } = useI18n();
  const cfg = useMemo(() => loadConfig(), []);
  const [weeks, setWeeks] = useState(Math.max(1, Math.round(cfg.lengthDays / 7)));
  const [days, setDays] = useState(cfg.weekdays.length || 6);
  const [posts, setPosts] = useState(cfg.times.length || 2);
  const [nets, setNets] = useState(Math.max(1, cfg.networks.length));
  const [cross, setCross] = useState(true);
  const [capMode, setCapMode] = useState<CaptionMode>('shared');
  const [reuseMedia, setReuseMedia] = useState(false); const [mediaDays, setMediaDays] = useState(cfg.mediaRepeatDays || 7);
  const [reuseCap, setReuseCap] = useState(false); const [capDays, setCapDays] = useState(cfg.captionReuseDays || 30);
  const [media, setMedia] = useState<MediaItem[]>([]); const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [caps, setCaps] = useState<Caption[]>([]); const [ready, setReady] = useState(0); const [loaded, setLoaded] = useState(false);
  useEffect(() => { Promise.all([listMedia(), dbGetAll<UsageRecord>('usage'), listCaptions(), listPairings()]).then(([m, u, c, p]) => { setMedia(m); setUsage(u); setCaps(c); setReady(p.filter((x) => x.status === 'confirmed').length); }).finally(() => setLoaded(true)); }, []);

  const availableMedia = useMemo(() => {
    const last = new Map<string, number>(); usage.forEach((u) => last.set(u.mediaId, Math.max(last.get(u.mediaId) ?? 0, new Date(u.at).getTime())));
    const win = (reuseMedia ? mediaDays : cfg.mediaRepeatDays) * 86400000;
    return media.filter((m) => { const l = last.get(m.id); return !l || win <= 0 || Date.now() - l >= win; }).length;
  }, [media, usage, reuseMedia, mediaDays, cfg.mediaRepeatDays]);
  const availableCaptions = useMemo(() => caps.filter((c) => isAvailable(c, reuseCap ? capDays : 0)).length, [caps, reuseCap, capDays]);

  const input: CalcInput = { weeks, daysPerWeek: days, postsPerDay: posts, networks: nets, crossPost: cross, captionMode: capMode, allowMediaReuse: reuseMedia, mediaRepeatDays: mediaDays, allowCaptionReuse: reuseCap, captionReuseDays: capDays, availableMedia, availableCaptions };
  const r = calculate(input);
  const row = (label: string, need: number, have: number, miss: number) => (
    <div className="num-grid">
      <div><small className="muted">{label}</small><span className="big-num">{need}</span><small className="muted">{t('calc.needed')}</small></div>
      <div><small className="muted">{t('calc.available')}</small><span className="big-num">{have}</span></div>
      <div><small className="muted">{t('calc.missing')}</small><span className={`big-num ${miss ? 'bad' : 'good'}`}>{miss}</span>{miss === 0 && <small className="good">{t('calc.enough')}</small>}</div>
    </div>
  );
  return (
    <div className="stack">
      <Notice>{t('calc.intro')}</Notice>
      <section className="card stack">
        <h2>{t('calc.plan')}</h2>
        <div className="form">
          <label>{t('calc.weeks')}<input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(num(e.target.value))} /></label>
          <label>{t('calc.days')}<input type="number" min={1} max={7} value={days} onChange={(e) => setDays(Math.min(7, num(e.target.value)))} /></label>
          <label>{t('calc.posts')}<input type="number" min={1} max={20} value={posts} onChange={(e) => setPosts(num(e.target.value))} /></label>
          <label>{t('calc.nets')}<select value={nets} onChange={(e) => setNets(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        </div>
        <label className="switch-row"><input type="checkbox" checked={cross} onChange={(e) => setCross(e.target.checked)} /><span>{t('calc.cross')}<br /><small className="muted">{t('calc.crossHint')}</small></span></label>
        {cross && nets > 1 && (
          <label className="row">{t('calc.capMode')}:
            <select value={capMode} onChange={(e) => setCapMode(e.target.value as CaptionMode)}><option value="shared">{t('calc.capShared')}</option><option value="perNetwork">{t('calc.capPer')}</option></select>
          </label>
        )}
        <label className="switch-row"><input type="checkbox" checked={reuseMedia} onChange={(e) => setReuseMedia(e.target.checked)} /><span>{t('calc.reuseMedia')}</span></label>
        {reuseMedia && <label className="row">{t('calc.after')} <input type="number" min={1} max={365} value={mediaDays} onChange={(e) => setMediaDays(num(e.target.value))} /> {t('set.days')}</label>}
        <label className="switch-row"><input type="checkbox" checked={reuseCap} onChange={(e) => setReuseCap(e.target.checked)} /><span>{t('calc.reuseCap')}</span></label>
        {reuseCap && <label className="row">{t('calc.after')} <input type="number" min={1} max={365} value={capDays} onChange={(e) => setCapDays(num(e.target.value))} /> {t('set.days')}</label>}
      </section>
      <section className="card stack">
        <h2>{t('calc.result')}</h2>
        <p className="bubble">{fmt(t('calc.formula'), { w: weeks, d: days, p: posts, n: r.packages })} {cross && nets > 1 ? fmt(t('calc.formulaNets'), { k: nets, n: r.publications }) : ''}</p>
        <div className="num-grid">
          <div><small className="muted">{t('calc.packages')}</small><span className="big-num">{r.packages}</span><small className="muted">{t('calc.packagesHint')}</small></div>
          <div><small className="muted">{t('calc.publications')}</small><span className="big-num">{r.publications}</span></div>
          <div><small className="muted">{t('calc.ready')}</small><span className="big-num">{ready}</span><small className="muted">{t('calc.readyHint')}</small></div>
        </div>
        <h2>{t('calc.mediaTitle')}</h2>{row(t('calc.mediaLabel'), r.mediaNeeded, availableMedia, r.mediaMissing)}
        <h2>{t('calc.capsTitle')}</h2>{row(t('calc.capsLabel'), r.captionsNeeded, availableCaptions, r.captionsMissing)}
        {(r.mediaSaved > 0 || r.captionsSaved > 0) && <Notice>{fmt(t('calc.saved'), { m: r.mediaSaved, c: r.captionsSaved })}</Notice>}
        <Notice tone={r.mediaMissing || r.captionsMissing ? 'warn' : 'info'}>{r.coverableWeeks >= 52 ? t('calc.cover52') : fmt(t('calc.cover'), { w: r.coverableWeeks })}</Notice>
        {loaded && ready < r.packages && <small className="muted">{fmt(t('calc.pairHint'), { n: Math.max(0, r.packages - ready) })}</small>}
        <small className="muted">{t('calc.note')}</small>
      </section>
    </div>
  );
}
