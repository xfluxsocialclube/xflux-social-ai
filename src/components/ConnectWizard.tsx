import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Notice } from './Notice';
import { useI18n } from '../i18n/I18nContext';
import { fmt } from '../i18n/format';
import type { TranslationKey } from '../i18n/pt';
import { connectYouTube } from '../services/oauth/youtube';
import { OAuthError, openExternal } from '../services/oauth/native';
import { readAppCredentials, saveAppCredentials, VaultError } from '../services/security/credentialVault';

const CONSOLE_URL = 'https://console.cloud.google.com/';
const KNOWN = ['desktop', 'timeout', 'denied', 'profile', 'vault'];

export function ConnectWizard({ name, onClose, onConnected }: {
  name: string; onClose: () => void; onConnected: () => void;
}) {
  const { t } = useI18n();
  const [clientId, setClientId] = useState('');
  const [storedId, setStoredId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    readAppCredentials('youtube').then((c) => {
      if (alive.current && c) { setStoredId(c.clientId); setClientId(c.clientId); }
    }).catch(() => undefined);
    return () => { alive.current = false; };
  }, []);

  const errText = (e: unknown) => {
    if (e instanceof VaultError) return t('wz.err.vault');
    const code = e instanceof OAuthError ? e.code : 'generic';
    return t(`wz.err.${KNOWN.includes(code) ? code : 'generic'}` as TranslationKey);
  };
  const start = async () => {
    setErr(null);
    const id = clientId.trim();
    const reuse = storedId !== null && id === storedId;
    if (!reuse && !id.includes('.apps.googleusercontent.com')) {
      setErr(t('wz.err.fields')); return;
    }
    setBusy(true);
    try {
      if (!reuse) await saveAppCredentials('youtube', { clientId: id });
      const acc = await connectYouTube();
      if (!alive.current) return;
      setDone(fmt(t('wz.done'), { name: acc.displayName }));
      onConnected();
    } catch (e) {
      if (alive.current) setErr(errText(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <Modal title={fmt(t('wz.title'), { name })} onClose={onClose}>
      <div className="stack">
        <Notice>{t('wz.intro')}</Notice>
        <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {[1, 2, 3, 4, 5, 6].map((n) => <li key={n}><small>{t(`wz.yt.${n}` as TranslationKey)}</small></li>)}
        </ol>
        <div><button className="btn ghost small" onClick={() => void openExternal(CONSOLE_URL)}>{t('wz.openConsole')}</button></div>
        <label className="wide">{t('wz.clientId')}<input className="search" autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)} /></label>
        <small className="muted">{t('wz.vaultNote')}</small>
        {busy && <Notice>{t('wz.waiting')}</Notice>}
        {err && <Notice tone="warn">{err}</Notice>}
        {done && <Notice>{done}</Notice>}
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>{t('lib.close')}</button>
        <button className="btn" disabled={busy || !!done} onClick={start}>{t('wz.authorize')}</button>
      </div>
    </Modal>
  );
}
