import { LanguageSelect } from '../components/LanguageSelect';
import { Notice } from '../components/Notice';
import { STORAGE_PROVIDERS } from '../services/storage';
import { saveSetting } from '../services/settings';
import { getRepeatDays } from '../services/library/library';
import { getCaptionReuseDays } from '../services/captions/store';
import { getAlertDays } from '../services/planner/plans';
import { useI18n } from '../i18n/I18nContext';

export function Settings({ showMascot, onToggleMascot }: { showMascot: boolean; onToggleMascot: (v: boolean) => void }) {
  const { t } = useI18n();
  return (
    <div className="stack">
      <section className="card">
        <h2>{t('set.language')}</h2>
        <LanguageSelect />
      </section>
      <section className="card">
        <label className="switch-row">
          <input type="checkbox" checked={showMascot} onChange={(e) => onToggleMascot(e.target.checked)} />
          <span><strong>{t('set.mascot')}</strong><br /><small className="muted">{t('set.mascotHint')}</small></span>
        </label>
      </section>
      <section className="card">
        <h2>{t('set.storage')}</h2>
        <Notice>{t('set.storageIntro')}</Notice>
        <ul className="list">
          {STORAGE_PROVIDERS.map((p) => (
            <li key={p.id}><span>{t(p.labelKey)}</span><span className="pill off">{t('common.planned')}</span></li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>{t('set.repeat')}</h2>
        <small className="muted">{t('set.repeatHint')}</small>
        <div style={{ marginTop: '.6rem' }}>
          <input type="number" min={0} max={365} defaultValue={getRepeatDays()} aria-label={t('set.repeat')}
            onChange={(e) => saveSetting('repeatDays', Math.max(0, Math.min(365, Number(e.target.value) || 0)))} /> {t('set.days')}
        </div>
      </section>
      <section className="card">
        <h2>{t('set.capReuse')}</h2>
        <small className="muted">{t('set.capReuseHint')}</small>
        <div style={{ marginTop: '.6rem' }}>
          <input type="number" min={0} max={365} defaultValue={getCaptionReuseDays()} aria-label={t('set.capReuse')}
            onChange={(e) => saveSetting('captionReuseDays', Math.max(0, Math.min(365, Number(e.target.value) || 0)))} /> {t('set.days')}
        </div>
      </section>
      <section className="card">
        <h2>{t('set.alert')}</h2>
        <small className="muted">{t('set.alertHint')}</small>
        <div style={{ marginTop: '.6rem' }}>
          <input type="number" min={0} max={30} defaultValue={getAlertDays()} aria-label={t('set.alert')}
            onChange={(e) => saveSetting('alertDays', Math.max(0, Math.min(30, Number(e.target.value) || 0)))} /> {t('set.days')}
        </div>
      </section>
    </div>
  );
}
