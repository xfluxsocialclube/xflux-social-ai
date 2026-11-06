/** Preferências locais simples (localStorage). Substituível por SQLite/Tauri em fase posterior. */
const PREFIX = 'xflux.';
export function loadSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
export function saveSetting<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* armazenamento indisponível: ignora */
  }
}
