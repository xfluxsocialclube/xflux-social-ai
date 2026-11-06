/** Preparo de mídia para modelos de visão. O vídeo NUNCA é carregado inteiro: apenas poucos quadros reduzidos. */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export function validateMedia(file: File): 'ai.an.badType' | 'ai.an.tooBig' | null {
  const img = file.type.startsWith('image/');
  const vid = file.type.startsWith('video/');
  if (!img && !vid) return 'ai.an.badType';
  if ((img && file.size > MAX_IMAGE_BYTES) || (vid && file.size > MAX_VIDEO_BYTES)) return 'ai.an.tooBig';
  return null;
}
function canvasToBase64(src: CanvasImageSource, w: number, h: number, maxSide: number): string {
  const s = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}
export async function imageToBase64(file: Blob, maxSide = 1024): Promise<string> {
  const bmp = await createImageBitmap(file);
  try { return canvasToBase64(bmp, bmp.width, bmp.height, maxSide); } finally { bmp.close(); }
}
export function videoFrames(file: File, count: number, maxSide = 768): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true; v.preload = 'metadata'; v.src = url;
    const finish = (err?: Error, out?: string[]) => { URL.revokeObjectURL(url); v.removeAttribute('src'); err ? reject(err) : resolve(out!); };
    const timer = window.setTimeout(() => finish(new Error('timeout')), 60000);
    v.onerror = () => { clearTimeout(timer); finish(new Error('unreadable')); };
    v.onloadedmetadata = async () => {
      const d = v.duration;
      if (!isFinite(d) || d <= 0) { clearTimeout(timer); return finish(new Error('unreadable')); }
      const out: string[] = [];
      try {
        for (let i = 1; i <= count; i++) {
          await new Promise<void>((ok) => { v.onseeked = () => ok(); v.currentTime = (d * i) / (count + 1); });
          out.push(canvasToBase64(v, v.videoWidth, v.videoHeight, maxSide));
        }
        clearTimeout(timer); finish(undefined, out);
      } catch { clearTimeout(timer); finish(new Error('unreadable')); }
    };
  });
}
