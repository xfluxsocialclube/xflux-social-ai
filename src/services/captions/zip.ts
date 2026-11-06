/** Leitura e escrita mínima de ZIP (necessária para XLSX). Sem dependências: usa DecompressionStream do navegador. */
export interface ZipEntry { name: string; method: number; compSize: number; size: number; offset: number; }
const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u32 = (d: DataView, o: number) => d.getUint32(o, true);

export function listZip(buf: Uint8Array): ZipEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) { if (u32(dv, i) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('not-zip');
  const total = u16(dv, eocd + 10); let p = u32(dv, eocd + 16);
  if (p === 0xffffffff || total === 0xffff) throw new Error('zip64');
  const out: ZipEntry[] = [];
  for (let n = 0; n < total; n++) {
    if (u32(dv, p) !== 0x02014b50) throw new Error('not-zip');
    const nameLen = u16(dv, p + 28), extra = u16(dv, p + 30), comment = u16(dv, p + 32);
    out.push({
      name: new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen)),
      method: u16(dv, p + 10), compSize: u32(dv, p + 20), size: u32(dv, p + 24), offset: u32(dv, p + 42),
    });
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const part = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const stream = new Blob([part]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export const MAX_ENTRY_BYTES = 80 * 1024 * 1024; // proteção contra arquivos "bomba"
export async function readZipEntry(buf: Uint8Array, e: ZipEntry): Promise<Uint8Array> {
  if (e.size > MAX_ENTRY_BYTES) throw new Error('too-big');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (u32(dv, e.offset) !== 0x04034b50) throw new Error('not-zip');
  const start = e.offset + 30 + u16(dv, e.offset + 26) + u16(dv, e.offset + 28);
  const raw = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return raw;
  if (e.method === 8) return inflateRaw(raw);
  throw new Error('zip-method');
}

let table: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!table) { table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Cria um ZIP sem compressão (suficiente e válido para XLSX). */
export function makeZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder(); const chunks: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name); const crc = crc32(f.data);
    const lh = new Uint8Array(30 + name.length); const l = new DataView(lh.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, 0, true);
    l.setUint16(10, 0, true); l.setUint16(12, 0x21, true); l.setUint32(14, crc, true); l.setUint32(18, f.data.length, true);
    l.setUint32(22, f.data.length, true); l.setUint16(26, name.length, true); l.setUint16(28, 0, true); lh.set(name, 30);
    const ch = new Uint8Array(46 + name.length); const c = new DataView(ch.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
    c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); ch.set(name, 46);
    chunks.push(lh, f.data); central.push(ch); offset += lh.length + f.data.length;
  }
  const cdSize = central.reduce((s, x) => s + x.length, 0);
  const end = new Uint8Array(22); const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
  const all = [...chunks, ...central, end]; const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0)); let p = 0;
  for (const x of all) { out.set(x, p); p += x.length; }
  return out;
}
