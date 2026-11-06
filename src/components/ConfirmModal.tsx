import { Modal } from './Modal';
import { useI18n } from '../i18n/I18nContext';

/** Confirmação antes de ações que apagam ou mudam muita coisa. */
export function ConfirmModal({ title, text, confirmLabel, onConfirm, onCancel }: { title: string; text: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{text}</p>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onCancel}>{t('lib.cancel')}</button>
        <button className="btn" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
