/**
 * Armazenamento em pasta do computador via File System Access API (Chrome/Edge).
 * Limitação: o navegador pede autorização novamente a cada vez que o app é aberto.
 * Em Tauri 2 isso será substituído por acesso direto ao disco.
 */
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

export const isSupported = () => typeof (window as unknown as Picker).showDirectoryPicker === 'function';

export async function getFolderStatus(): Promise<FolderStatus> {
  if (!isSupported()) return 'unsupported';
  const h = await kvGet<Dir>(KEY);
  if (!h) return 'none';
  const p = await (h as unknown as PermHandle).queryPermission({ mode: 'readwrite' });
  return p === 'granted' ? 'ready' : 'needs-permission';
}
export async function chooseFolder(): Promise<void> {
  const h = await (window as unknown as Picker).showDirectoryPicker!({ mode: 'readwrite' });
  await kvSet(KEY, h);
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
}
/** Deve ser chamado a partir de um clique do usuário. */
export async function requestAccess(): Promise<boolean> {
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
  const { dir, name } = await parentOf(path, true);
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(file);
  await w.close();
}
export async function readLibraryFile(path: string): Promise<File> {
  const { dir, name } = await parentOf(path, false);
  return (await dir.getFileHandle(name)).getFile();
}
export async function deleteLibraryFile(path: string): Promise<void> {
  try {
    const { dir, name } = await parentOf(path, false);
    await dir.removeEntry(name);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e;
  }
}
