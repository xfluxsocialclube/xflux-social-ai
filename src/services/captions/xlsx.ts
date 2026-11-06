/** Leitor e gerador mínimo de planilhas XLSX (sem bibliotecas). Lê o 1º formato do Excel moderno (.xlsx). */
import { listZip, makeZip, readZipEntry, type ZipEntry } from './zip';

const td = new TextDecoder();
const te = new TextEncoder();
const decodeXml = (s: string) => s
  .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&#x([0-9A-Fa-f]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attrs = (s: string) => { const o: Record<string, string> = {}; for (const m of s.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) o[m[1]] = decodeXml(m[2] ?? m[3] ?? ''); return o; };
const textOf = (xml: string) => { // junta todos os <t> (ignora fonética <rPh>)
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = ''; for (const m of clean.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) out += m[1];
  return decodeXml(out);
};
const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/[^A-Za-z]/g, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };

export interface XlsxBook { sheets: string[]; readSheet(index: number): Promise<string[][]>; }

export async function openXlsx(buffer: ArrayBuffer): Promise<XlsxBook> {
  const buf = new Uint8Array(buffer);
  const entries = new Map<string, ZipEntry>(listZip(buf).map((e) => [e.name, e]));
  const read = async (name: string) => { const e = entries.get(name); return e ? td.decode(await readZipEntry(buf, e)) : null; };
  const wb = await read('xl/workbook.xml');
  if (!wb) throw new Error('not-xlsx');
  const rels = await read('xl/_rels/workbook.xml.rels');
  const relTarget = new Map<string, string>();
  for (const m of (rels ?? '').matchAll(/<Relationship\b([^>]*?)\/?>/g)) { const a = attrs(m[1]); if (a.Id) relTarget.set(a.Id, a.Target); }
  const sheets: { name: string; path: string }[] = [];
  for (const m of wb.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const a = attrs(m[1]); const rid = a['r:id'] ?? Object.entries(a).find(([k]) => k.endsWith(':id'))?.[1];
    let target = rid ? relTarget.get(rid) : undefined;
    if (!target) target = `worksheets/sheet${sheets.length + 1}.xml`;
    sheets.push({ name: a.name ?? `Sheet${sheets.length + 1}`, path: target.startsWith('/') ? target.slice(1) : `xl/${target}` });
  }
  if (!sheets.length) throw new Error('not-xlsx');
  let shared: string[] | null = null;
  const getShared = async () => {
    if (shared) return shared;
    shared = []; const x = await read('xl/sharedStrings.xml');
    if (x) for (const m of x.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)) shared.push(m[1] ? textOf(m[1]) : '');
    return shared;
  };
  return {
    sheets: sheets.map((s) => s.name),
    async readSheet(index: number) {
      const xml = await read(sheets[index].path);
      if (xml === null) throw new Error('not-xlsx');
      const strings = await getShared();
      const grid = new Map<number, Map<number, string>>(); let maxCol = 0; let seqRow = -1;
      for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
        const ra = attrs(rm[1]); seqRow = ra.r ? Number(ra.r) - 1 : seqRow + 1;
        if (!rm[2]) continue;
        let seqCol = -1;
        for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const ca = attrs(cm[1]); const col = ca.r ? colIndex(ca.r) : seqCol + 1; seqCol = col;
          const body = cm[2] ?? ''; let v = '';
          if (ca.t === 'inlineStr') v = textOf(body.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? '');
          else {
            const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
            if (raw !== undefined) {
              if (ca.t === 's') v = strings[Number(raw)] ?? '';
              else if (ca.t === 'b') v = raw === '1' ? 'TRUE' : 'FALSE';
              else if (ca.t === 'e') v = '';
              else v = decodeXml(raw);
            }
          }
          if (v === '') continue;
          if (!grid.has(seqRow)) grid.set(seqRow, new Map());
          grid.get(seqRow)!.set(col, v); if (col > maxCol) maxCol = col;
        }
      }
      const lastRow = Math.max(-1, ...grid.keys());
      const rows: string[][] = [];
      for (let r = 0; r <= lastRow; r++) { const m = grid.get(r); rows.push(Array.from({ length: maxCol + 1 }, (_, c) => m?.get(c) ?? '')); }
      return rows;
    },
  };
}

const esc = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

/** Gera um arquivo .xlsx (strings em linha, sem fórmulas). A primeira linha é o cabeçalho (negrito). */
export function writeXlsx(rows: string[][], sheetName = 'Legendas', widths: number[] = []): Uint8Array {
  const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === '' ? '' : `<c r="${colName(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join('');
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const files = [
    ['[Content_Types].xml', `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ['_rels/.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${head}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${head}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `${head}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ['xl/worksheets/sheet1.xml', `${head}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sheetRows}</sheetData></worksheet>`],
  ] as const;
  return makeZip(files.map(([name, xml]) => ({ name, data: te.encode(xml) })));
}
