// Spreadsheet model + import/export helpers
import { state } from './state.js';

export function colLetter(n) {
  let s = '';
  n += 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export function newSheet(name = 'Nova Planilha', cols = 6, rows = 20) {
  const header = [];
  const defaults = ['Data', 'Descrição', 'Categoria', 'Débito', 'Crédito', 'Saldo'];
  for (let c = 0; c < cols; c++) header.push(defaults[c] || 'Coluna ' + colLetter(c));
  const body = [];
  for (let r = 0; r < rows; r++) body.push(new Array(cols).fill(''));
  return { name, header, rows: body };
}

// Build sheet from a 2D array of arrays (first row = header)
export function fromMatrix(name, matrix) {
  if (!matrix || !matrix.length) return newSheet(name);
  let maxCols = 0;
  matrix.forEach(r => { if (r.length > maxCols) maxCols = r.length; });
  maxCols = Math.max(maxCols, 1);
  const header = [];
  const first = matrix[0] || [];
  for (let c = 0; c < maxCols; c++) {
    const v = first[c];
    header.push(v !== undefined && v !== null && String(v).trim() !== '' ? String(v) : 'Coluna ' + colLetter(c));
  }
  const rows = matrix.slice(1).map(r => {
    const out = new Array(maxCols).fill('');
    for (let c = 0; c < maxCols; c++) out[c] = r[c] !== undefined && r[c] !== null ? String(r[c]) : '';
    return out;
  });
  // ensure minimum rows
  while (rows.length < 8) rows.push(new Array(maxCols).fill(''));
  return { name, header, rows };
}

export async function importFile(file) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const first = wb.SheetNames[0];
  const ws = wb.Sheets[first];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  const name = file.name.replace(/\.[^.]+$/, '');
  return fromMatrix(name, matrix);
}

export function toMatrix(sheet) {
  return [sheet.header.slice(), ...sheet.rows.map(r => r.slice())];
}

export function exportXlsx(sheet) {
  const ws = XLSX.utils.aoa_to_sheet(toMatrix(sheet));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha');
  XLSX.writeFile(wb, (sheet.name || 'planilha') + '.xlsx');
}

export function exportCsv(sheet) {
  const ws = XLSX.utils.aoa_to_sheet(toMatrix(sheet));
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (sheet.name || 'planilha') + '.csv';
  a.click();
}

// Compact text representation for the AI
export function sheetToText(sheet, maxRows = 200) {
  const lines = [];
  lines.push('Colunas: ' + sheet.header.join(' | '));
  const rows = sheet.rows.filter(r => r.some(c => String(c).trim() !== ''));
  rows.slice(0, maxRows).forEach((r, i) => {
    lines.push((i + 1) + ': ' + r.join(' | '));
  });
  if (rows.length > maxRows) lines.push('... (' + (rows.length - maxRows) + ' linhas adicionais omitidas)');
  lines.push('Total de linhas com dados: ' + rows.length);
  return lines.join('\n');
}

// Basic numeric analytics used to enrich the AI prompt and dashboard
export function numericSummary(sheet) {
  const parse = (v) => {
    if (v === null || v === undefined) return NaN;
    let s = String(v).trim();
    if (!s) return NaN;
    s = s.replace(/[R$\s%]/g, '');
    // handle 1.234,56 (pt-BR) vs 1,234.56
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  };
  const cols = sheet.header.map((h, idx) => {
    const vals = sheet.rows.map(r => parse(r[idx])).filter(n => !isNaN(n));
    if (vals.length < 2) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return { name: h, idx, count: vals.length, sum, min: Math.min(...vals), max: Math.max(...vals), avg: sum / vals.length };
  }).filter(Boolean);
  const filled = sheet.rows.filter(r => r.some(c => String(c).trim() !== '')).length;
  return { numericCols: cols, filledRows: filled, totalCols: sheet.header.length };
}
