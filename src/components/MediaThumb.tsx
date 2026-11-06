import { useEffect, useState } from 'react';
import type { MediaItem } from '../services/library/types';

/** Miniatura de um arquivo da Biblioteca (usa a miniatura já salva no banco). */
export function MediaThumb({ item, size = 64 }: { item: MediaItem | undefined; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!item?.thumb) { setUrl(null); return; }
    const u = URL.createObjectURL(item.thumb); setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [item?.thumb]);
  return (
    <div className="mthumb" style={{ width: size, height: size }}>
      {url ? <img src={url} alt={item?.name ?? ''} /> : <span>{item ? item.ext.toUpperCase() : '?'}</span>}
      {item?.kind === 'video' && <i className="play">▶</i>}
    </div>
  );
}
