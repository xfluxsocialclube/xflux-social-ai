import { CopyButton } from '../components/CopyButton';
import { Notice } from '../components/Notice';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/pt';
import type { PageId } from '../config/nav';

const FAQ = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Central de ajuda: acesso permanente ao guia do FLUX e respostas curtas para as dúvidas mais comuns. */
export function Help({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { t } = useI18n();
  return (
    <div className="stack">
      <section className="card stack">
        <h2>{t('help.guideTitle')}</h2>
        <p style={{ margin: 0 }}>{t('help.guideDesc')}</p>
        <div><button className="btn" onClick={() => onNavigate('guide')}>{t('nav.guide')}</button></div>
      </section>
      <section className="card stack">
        <h2>{t('cb.promptTitle')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('help.promptDesc')}</p>
        <p className="output">{t('cb.promptBody')}</p>
        <div><CopyButton text={t('cb.promptBody')} /></div>
      </section>
      <section className="card stack">
        <h2>{t('help.faq')}</h2>
        {FAQ.map((n) => <div key={n}><strong>{t(`help.q${n}` as TranslationKey)}</strong><p className="muted" style={{ margin: '.2rem 0 .6rem' }}>{t(`help.a${n}` as TranslationKey)}</p></div>)}
      </section>
      <Notice>{t('ap.honest')}</Notice>
    </div>
  );
}
