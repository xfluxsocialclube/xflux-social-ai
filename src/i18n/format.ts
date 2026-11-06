/** Substitui {nome} nos textos traduzidos: fmt('{n} arquivos', { n: 3 }). */
export const fmt = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
