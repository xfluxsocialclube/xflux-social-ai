import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';

export function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button className="btn ghost small" disabled={!text} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* sem permissão */ }
    }}>{done ? t('ai.copied') : t('ai.copy')}</button>
  );
}
