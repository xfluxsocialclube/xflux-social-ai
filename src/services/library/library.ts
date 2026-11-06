/** Regras de negócio da biblioteca: importação, duplicados, categorias, histórico, uso e anti-repetição. */
import { dbDelete, dbGetAll, dbPut } from '../db';
import { loadSetting } from '../settings';
import { deleteLibraryFile, writeLibraryFile } from './fsStore';
import { makeThumb } from './thumbs';
import type { Category, HistoryAction, HistoryEntry, ImportReport, MediaItem, UsageRecord } from './types';

export const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1 GB (o hash SHA-256 lê o arquivo na memória)
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function log(action: HistoryAction, mediaId: string, name: string) {
  const e: HistoryEntry = { id: uid(), at: now(), action, mediaId, name };
  await dbPut('history', e);
}
const safeName = (n: string) => n.replace(/[\\/:*?"<>|]/g, '_');

export const listMedia = () => dbGetAll<MediaItem>('media');
export const listCategories = () => dbGetAll<Category>('categories');
export async function listHistory(limit = 30): Promise<HistoryEntry[]> {
  return (await dbGetAll<HistoryEntry>('history')).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
export async function addCategory(name: string): Promise<void> {
  const n = name.trim();
  if (!n) return;
  const existing = await listCategories();
  if (existing.some((c) => c.name.toLowerCase() === n.toLowerCase())) return;
  await dbPut('categories', { id: uid(), name: n } satisfies Category);
}

export async function importFiles(files: File[]): Promise<ImportReport> {
  const report: ImportReport = { imported: 0, duplicates: 0, rejected: [] };
  const known = new Set((await listMedia()).map((m) => m.hash));
  for (const file of files) {
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!kind) { report.rejected.push({ name: file.name, reason: 'type' }); continue; }
    if (file.size > MAX_FILE_BYTES) { report.rejected.push({ name: file.name, reason: 'size' }); continue; }
    try {
      const hash = await sha256(file);
      if (known.has(hash)) { report.duplicates++; await log('duplicate', '', file.name); continue; }
      const d = new Date();
      const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${hash.slice(0, 8)}-${safeName(file.name)}`;
      await writeLibraryFile(path, file);
      const info = await makeThumb(file);
      const item: MediaItem = {
        id: uid(), name: file.name, ext: (file.name.split('.').pop() ?? '').toLowerCase(), mime: file.type, kind,
        size: file.size, hash, path, importedAt: now(), categoryId: null, ai: null, ...info,
      };
      await dbPut('media', item);
      await log('import', item.id, item.name);
      known.add(hash);
      report.imported++;
    } catch {
      report.rejected.push({ name: file.name, reason: 'error' });
    }
  }
  return report;
}
export async function deleteMedia(item: MediaItem): Promise<void> {
  await deleteLibraryFile(item.path);
  await dbDelete('media', item.id);
  await log('delete', item.id, item.name);
}
export async function setItemCategory(item: MediaItem, categoryId: string | null): Promise<MediaItem> {
  const updated = { ...item, categoryId };
  await dbPut('media', updated);
  await log('category', item.id, item.name);
  return updated;
}

/* ---------- Uso e proteção contra repetição ---------- */
export async function getUsage(mediaId: string): Promise<UsageRecord[]> {
  return (await dbGetAll<UsageRecord>('usage')).filter((u) => u.mediaId === mediaId).sort((a, b) => b.at.localeCompare(a.at));
}
/** Chamado pelos módulos de publicação (fases futuras) quando um arquivo for realmente usado. */
export async function recordUsage(item: MediaItem, network: string, postRef: string | null): Promise<void> {
  await dbPut('usage', { id: uid(), mediaId: item.id, mediaName: item.name, network, postRef, at: now() } satisfies UsageRecord);
}
export const getRepeatDays = () => loadSetting<number>('repeatDays', 30);
/** Retorna a data até quando o arquivo deve ficar sem ser reutilizado, ou null se estiver liberado. */
export async function repeatBlockedUntil(mediaId: string, days = getRepeatDays()): Promise<Date | null> {
  if (days <= 0) return null;
  const last = (await getUsage(mediaId))[0];
  if (!last) return null;
  const until = new Date(new Date(last.at).getTime() + days * 86400000);
  return until.getTime() > Date.now() ? until : null;
}
