import { EmptyState } from '../components/EmptyState';
import { Notice } from '../components/Notice';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/pt';

/** Página genérica para módulos ainda não implementados: estado vazio + aviso honesto. */
export function ModulePage({ descKey }: { descKey: TranslationKey }) {
  const { t } = useI18n();
  return (
    <div className="stack">
      <Notice>{t('common.notAvailable')}</Notice>
      <div className="card"><EmptyState title={t('mod.emptyTitle')} description={t(descKey)} /></div>
    </div>
  );
}
