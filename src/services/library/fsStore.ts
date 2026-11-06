/**
 * Armazenamento da Biblioteca:
 * - Windows/Tauri: pasta escolhida pelo usuário, acessada pela API nativa.
 * - Navegador: File System Access API (Chrome/Edge).
 */
import { isTauri } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import { kvGet, kvSet } from '../db';

type Dir = FileSystemDirectoryHandle;
interface PermHandle {
  queryPermission(d: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(d: { mode: 'readwrite' }): Promise<PermissionState>;
}
type Picker = { showDirectoryPicker?: (o: { mode: 'readwrite' }) => Promise<Dir> };
export type FolderStatus = 'unsupported' | 'none' | 'needs-permission' | 'ready';
const KEY = 'libraryDir';
const ROOT_NAME = 'XFLUX-Biblioteca';

export const isSupported = () => isTauri() || typeof (window as unknown as Picker).showDirectoryPicker === 'function';

async function nativeFolder(): Promise<string | undefined> {
  return kvGet<string>(KEY);
}
async function nativeRoot(relativePath?: string): Promise<string> {
  const base = await nativeFolder();
  if (!base) throw new Error('no-folder');
  return relativePath
    ? join(base, ROOT_NAME, ...relativePath.split('/').filter(Boolean))
    : join(base, ROOT_NAME);
}
async function selectNativeFolder(): Promise<string | null> {
  const selected = await openDialog({ directory: true, multiple: false, title: 'Escolha onde o XFLUX guardará seus vídeos e imagens' });
  if (typeof selected !== 'string' || !selected) return null;
  await kvSet(KEY, selected);
  await mkdir(await nativeRoot(), { recursive: true });
  return selected;
}

export async function getFolderStatus(): Promise<FolderStatus> {
  if (isTauri()) {
    const path = await nativeFolder();
    if (!path) return 'none';
    try { return await exists(path) ? 'ready' : 'needs-permission'; }
    catch { return 'needs-permission'; }
  }
  if (!isSupported()) return 'unsupported';
  const h = await kvGet<Dir>(KEY);
  if (!h) return 'none';
  const p = await (h as unknown as PermHandle).queryPermission({ mode: 'readwrite' });
  return p === 'granted' ? 'ready' : 'needs-permission';
}
export async function chooseFolder(): Promise<void> {
  if (isTauri()) { await selectNativeFolder(); return; }
  const h = await (window as unknown as Picker).showDirectoryPicker!({ mode: 'readwrite' });
  await kvSet(KEY, h);
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
}
/** No Windows, o seletor nativo renova o escopo da pasta escolhida. */
export async function requestAccess(): Promise<boolean> {
  if (isTauri()) return Boolean(await selectNativeFolder());
  const h = await kvGet<Dir>(KEY);
  if (!h) return false;
  return (await (h as unknown as PermHandle).requestPermission({ mode: 'readwrite' })) === 'granted';
}
async function root(): Promise<Dir> {
  const h = await kvGet<Dir>(KEY);
  if (!h) throw new Error('no-folder');
  return h.getDirectoryHandle(ROOT_NAME, { create: true });
}
async function parentOf(path: string, create: boolean): Promise<{ dir: Dir; name: string }> {
  const parts = path.split('/');
  const name = parts.pop()!;
  let dir = await root();
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
  return { dir, name };
}
export async function writeLibraryFile(path: string, file: Blob): Promise<void> {
  if (isTauri()) {
    const fullPath = await nativeRoot(path);
    const parent = fullPath.slice(0, fullPath.lastIndexOf('/'));
    await mkdir(parent, { recursive: true });
    await writeFile(fullPath, new Uint8Array(await file.arrayBuffer()));
    return;
  }
  const { dir, name } = await parentOf(path, true);
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
}
export async function readLibraryFile(path: string): Promise<File> {
  if (isTauri()) {
    const bytes = await readFile(await nativeRoot(path));
    const name = path.split('/').pop() ?? 'media';
    return new File([bytes], name);
  }
  const { dir, name } = await parentOf(path, false);
  return (await dir.getFileHandle(name)).getFile();
}
export async function deleteLibraryFile(path: string): Promise<void> {
  if (isTauri()) {
    const fullPath = await nativeRoot(path);
    if (await exists(fullPath)) await remove(fullPath);
    return;
  }
  try {
    const { dir, name } = await parentOf(path, false);
    await dir.removeEntry(name);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e;
  }
}
