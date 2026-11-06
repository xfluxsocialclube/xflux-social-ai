/** Geração de miniaturas (imagem reduzida) e leitura de dimensões/duração. */
const MAX = 240;
export interface ThumbInfo { thumb?: Blob; width?: number; height?: number; duration?: number; }

function drawToBlob(src: CanvasImageSource, w: number, h: number): Promise<Blob | undefined> {
  const scale = Math.min(1, MAX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? undefined), 'image/jpeg', 0.8));
}
async function imageInfo(file: File): Promise<ThumbInfo> {
  try {
    const bmp = await createImageBitmap(file);
    const info = { thumb: await drawToBlob(bmp, bmp.width, bmp.height), width: bmp.width, height: bmp.height };
    bmp.close();
    return info;
  } catch { return {}; }
}
function videoInfo(file: File): Promise<ThumbInfo> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    const done = (info: ThumbInfo) => { URL.revokeObjectURL(url); v.removeAttribute('src'); resolve(info); };
    const timer = window.setTimeout(() => done({}), 10000);
    v.muted = true; v.preload = 'metadata'; v.src = url;
    v.onerror = () => { clearTimeout(timer); done({}); };
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 0) / 2); };
    v.onseeked = async () => {
      clearTimeout(timer);
      const thumb = await drawToBlob(v, v.videoWidth, v.videoHeight);
      done({ thumb, width: v.videoWidth, height: v.videoHeight, duration: v.duration });
    };
  });
}
export const makeThumb = (file: File): Promise<ThumbInfo> => (file.type.startsWith('video/') ? videoInfo(file) : imageInfo(file));
