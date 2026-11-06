/** Datas locais no formato AAAA-MM-DD (sem fuso horário: o planejamento é do dia do usuário). */
const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayYmd = () => ymd(new Date());
export const addDays = (s: string, n: number) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
/** Dias entre duas datas (b - a), sem erro de horário de verão. */
export const diffDays = (a: string, b: string) => { const [ya, ma, da] = a.split('-').map(Number); const [yb, mb, db] = b.split('-').map(Number); return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000); };
/** 0 = segunda … 6 = domingo (mesma ordem de days.0 … days.6 nas traduções). */
export const weekdayIdx = (s: string) => (parseYmd(s).getDay() + 6) % 7;
export const startOfWeek = (s: string) => addDays(s, -weekdayIdx(s));
export const isValidYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseYmd(s)) === s;
export const isValidTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function enumerateDays(start: string, count: number): string[] { return Array.from({ length: Math.max(0, count) }, (_, i) => addDays(start, i)); }
/** Dias do mês em semanas completas (segunda a domingo), para a visualização mensal. */
export function monthGrid(year: number, month0: number): string[][] {
  const first = ymd(new Date(year, month0, 1)); const last = ymd(new Date(year, month0 + 1, 0));
  const weeks: string[][] = []; let d = startOfWeek(first);
  while (d <= last) { weeks.push(enumerateDays(d, 7)); d = addDays(d, 7); }
  return weeks;
}
