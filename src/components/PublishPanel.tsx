import { useMemo, useState } from 'react';
import { CopyButton } from './CopyButton';
import { NetTag } from './NetTag';
import { Notice } from './Notice';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/format';
import type { TranslationKey } from '../i18n/pt';
import type { Caption } from '../services/captions/types';
import type { MediaItem } from '../services/library/types';
import { loadSnapshot } from '../services/backend/accounts';
import { buildPackage, planRoute } from '../services/publishing/delivery';
import { ERROR_INFO } from '../services/publishing/errors';
import { confirmedBy, queueState, reportFailure, retryPost, startAssisted } from '../services/publishing/queue';
import type { ErrorCode } from '../services/publishing/types';
import type { PlannedPost } from '../services/planner/types';

const REPORTABLE: ErrorCode[] = ['user-reported', 'media-invalid', 'platform-rejected', 'audit-required', 'rate-limited', 'token-expired', 'permission-missing', 'unknown'];

/** Como publicar esta publicação AGORA (assistido), o que falta para ser automática, e o histórico de tentativas. */
export function PublishPanel({ post, media, caption, onChanged }: { post: PlannedPost; media?: MediaItem; caption?: Caption; onChanged: () => void }) {
  const { t, locale } = useI18n();
  const route = useMemo(() => planRoute(post.network, loadSnapshot()), [post.network]);
  const pkg = useMemo(() => buildPackage(post, caption, media), [post, caption, media]);
  const [failing, setFailing] = useState(false); const [code, setCode] = useState<ErrorCode>('user-reported'); const [note, setNote] = useState(''); const [err, setErr] = useState(false);
  const state = queueState(post); const attempts = post.delivery?.attempts ?? [];
  const run = async (fn: () => Promise<unknown>) => { setErr(false); try { await fn(); onChanged(); } catch { setErr(true); } };
  const d = (iso: string) => new Date(iso).toLocaleString(locale);
  const open = post.status === 'scheduled';
  return (
    <div className="stack">
      {err && <Notice tone="warn">{t('cb.err.save')}</Notice>}
      {post.status === 'published' && <Notice>{t(`pub.q.confirmedBy.${confirmedBy(post) ?? 'user'}` as TranslationKey)}</Notice>}
      {open && (<>
        <div className="row"><span className="pill">{t('pub.route.assisted')}</span><NetTag id={post.network} /></div>
        <details><summary className="muted">{t('pub.route.missing')} ({route.blockers.length})</summary>
          <ul className="list">{route.blockers.map((b) => <li key={b}><small>{t(`pub.blk.${b}` as TranslationKey)}</small></li>)}</ul></details>
        <h2>{t('pub.pkg.title')}</h2>
        <small className="muted">{fmt(t('pub.pkg.when'), { d: pkg.scheduledLocal, tz: pkg.timeZone })}{pkg.mediaName ? ` · ${fmt(t('pub.pkg.media'), { n: pkg.mediaName })}` : ''}</small>
        {pkg.fields.map((f) => (
          <div key={f.key}><strong>{t(`pub.field.${f.key}` as TranslationKey)}</strong>
            {f.userChoice ? <small className="muted"> — {t('pub.field.userChoice')}</small> : <><p className="output">{f.value}</p><CopyButton text={f.value} /></>}
          </div>
        ))}
        <h2>{t('pub.steps.title')}</h2>
        <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>{[1, 2, 3, 4, 5].map((n) => <li key={n}><small>{t(`pub.step.${n}` as TranslationKey)}</small></li>)}</ol>
        <small className="muted">{t(`pub.note.${post.network}` as TranslationKey)}</small>
        <div className="row">
          {state !== 'awaiting-user' && state !== 'failed' && <button className="btn ghost small" onClick={() => run(() => startAssisted(post))}>{t('pub.start')}</button>}
          {state === 'failed' && <button className="btn small" onClick={() => run(() => retryPost(post))}>{t('pub.retry')}</button>}
          <button className="btn ghost small" onClick={() => setFailing(!failing)}>{t('pub.fail')}</button>
        </div>
        {failing && (
          <div className="stack card" style={{ padding: '.7rem' }}>
            <label className="row">{t('pub.fail.reason')}: <select value={code} onChange={(e) => setCode(e.target.value as ErrorCode)}>{REPORTABLE.map((c) => <option key={c} value={c}>{t(`pub.err.${c}` as TranslationKey)}</option>)}</select></label>
            <textarea rows={2} placeholder={t('pub.fail.note')} value={note} onChange={(e) => setNote(e.target.value)} />
            <small className="muted">{t(`pub.next.${ERROR_INFO[code].action}` as TranslationKey)}</small>
            <div><button className="btn small" onClick={() => run(async () => { await reportFailure(post, code, note); setFailing(false); setNote(''); })}>{t('pub.fail.save')}</button></div>
          </div>
        )}
      </>)}
      <h2>{t('pub.att.title')}</h2>
      {attempts.length === 0 ? <small className="muted">{t('pub.att.none')}</small> : (
        <ul className="list">{[...attempts].reverse().map((a) => (
          <li key={a.id}><span><strong>{t(`pub.att.${a.outcome}` as TranslationKey)}</strong>{a.errorCode ? ` — ${t(`pub.err.${a.errorCode}` as TranslationKey)}` : ''}{a.note ? ` (${a.note})` : ''}</span><small className="muted">{d(a.at)}</small></li>
        ))}</ul>
      )}
      {post.delivery?.nextRetryAt && state === 'failed' && <small className="muted">{fmt(t('pub.att.retry'), { d: d(post.delivery.nextRetryAt) })}</small>}
    </div>
  );
}
