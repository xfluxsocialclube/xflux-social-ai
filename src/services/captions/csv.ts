/** Leitura de CSV (aspas, quebras de linha dentro de células, ; , ou tab) e decodificação de texto. */
export function decodeText(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('windows-1252').decode(bytes); } // CSV do Excel em português costuma ser ANSI
}

export function detectDelimiter(text: string): string {
  let inQ = false; const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQ = !inQ;
    else if (!inQ) { if (ch === '\n') break; if (ch in counts) counts[ch]++; }
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = []; let cell = ''; let inQ = false;
  const pushCell = () => { row.push(cell); cell = ''; };
  const pushRow = () => { pushCell(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') inQ = true;
    else if (ch === delimiter) pushCell();
    else if (ch === '\n') pushRow();
    else if (ch === '\r') { if (text[i + 1] === '\n') i++; pushRow(); }
    else cell += ch;
  }
  if (cell !== '' || row.length) pushRow();
  return rows;
}

/** Gera CSV (delimitador ; e BOM UTF-8: abre corretamente no Excel em português). */
export function toCsv(rows: string[][], delimiter = ';'): string {
  const esc = (v: string) => (/["\n\r;,\t]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return '\uFEFF' + rows.map((r) => r.map(esc).join(delimiter)).join('\r\n') + '\r\n';
}
