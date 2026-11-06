import { OllamaError } from '../../services/ollama';
import type { TranslationKey } from '../../i18n/pt';

/** Converte qualquer erro em mensagem compreensível. Retorna '' quando o usuário apenas cancelou. */
export function describeError(e: unknown, t: (k: TranslationKey) => string): string {
  if (e instanceof OllamaError) {
    if (e.code === 'aborted') return '';
    if (e.code === 'offline') return t('ai.err.offline');
    if (e.code === 'model') return t('ai.err.model');
    if (e.code === 'url') return t('ai.err.url');
    return `${t('ai.err.http')} ${e.message}`;
  }
  return String(e instanceof Error ? e.message : e);
}
