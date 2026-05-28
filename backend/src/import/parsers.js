const fs = require('fs');

// Google Ads exports are commonly UTF-16 LE TSV, but some reports arrive as
// UTF-8 CSV. A few placement names also contain quoted newlines.
//
//   line 1: report title (e.g. "Campaign report")
//   line 2: date range (e.g. "February 1, 2026 - April 30, 2026")
//   line 3: column headers
//   line 4..N: data rows
// Trailing rows starting with "Total" are aggregate roll-ups and are skipped.
function readReport(filePath) {
  const buf = fs.readFileSync(filePath);
  let text;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    text = buf.slice(2).toString('utf16le');
  } else if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    text = buf.slice(3).toString('utf8');
  } else {
    text = buf.toString('utf8');
  }

  const previewLines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (previewLines.length < 3) throw new Error(`Report ${filePath} has too few lines`);

  const delimiter = detectDelimiter(previewLines);
  const records = parseDelimitedRecords(text, delimiter).filter((r) =>
    r.some((cell) => cell.trim().length > 0)
  );
  if (records.length < 3) throw new Error(`Report ${filePath} has too few records`);

  const title = (records[0][0] || '').trim();
  const headerIndex = findHeaderIndex(records);
  const dateRange = detectDateRange(records);
  const headers = records[headerIndex];
  const rows = [];
  for (let i = headerIndex + 1; i < records.length; i++) {
    const cells = records[i];
    if (cells.length === 0) continue;
    const first = (cells[0] || '').trim();
    if (/^Total/i.test(first)) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h.trim()] = (cells[idx] ?? '').trim(); });
    rows.push(obj);
  }
  return { title, dateRange, headers: headers.map((h) => h.trim()), rows };
}

function findHeaderIndex(records) {
  const looksLikeHeader = (record) => {
    const headers = record.map((h) => h.trim());
    const joined = headers.join('|').toLowerCase();
    const hasDimension = headers.includes('Campaign') ||
      headers.includes('Campaign Name') ||
      headers.includes('Location') ||
      headers.includes('Placement') ||
      headers.includes('Ad Name');
    const hasMetric = joined.includes('impr') ||
      joined.includes('impressions') ||
      joined.includes('clicks') ||
      joined.includes('total spent');
    return hasDimension && hasMetric;
  };

  const idx = records.findIndex(looksLikeHeader);
  return idx === -1 ? 2 : idx;
}

function detectDateRange(records) {
  const second = (records[1]?.[0] || '').trim();
  const third = (records[2]?.[0] || '').trim();

  if (/^Report Start:/i.test(second) && /^Report End:/i.test(third)) {
    const start = cleanReportDate(second);
    const end = cleanReportDate(third);
    return start && end ? `${start} - ${end}` : `${second} - ${third}`;
  }

  return second.replace(/^"|"$/g, '').trim();
}

function cleanReportDate(value) {
  const raw = String(value).replace(/^Report (Start|End):\s*/i, '').trim();
  const m = raw.match(/^([A-Za-z]+\s+\d{1,2},\s+\d{4})/);
  return m ? m[1] : raw;
}

function detectDelimiter(lines) {
  const tabCount = lines.reduce((sum, line) => sum + (line.match(/\t/g) || []).length, 0);
  const commaCount = lines.reduce((sum, line) => sum + (line.match(/,/g) || []).length, 0);
  return tabCount > commaCount ? '\t' : ',';
}

// Delimited parser with quote handling for Google TSV/CSV exports, including
// quoted newlines inside a field.
function parseDelimitedRecords(text, delimiter) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuote = false;

  function pushCell() {
    row.push(cur);
    cur = '';
  }

  function pushRow() {
    pushCell();
    rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }
    if (ch === delimiter && !inQuote) { pushCell(); continue; }
    if ((ch === '\n' || ch === '\r') && !inQuote) {
      pushRow();
      if (ch === '\r' && text[i + 1] === '\n') i++;
      continue;
    }
    if ((ch === '\n' || ch === '\r') && inQuote) {
      cur += ' ';
      if (ch === '\r' && text[i + 1] === '\n') i++;
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) pushRow();
  return rows;
}

// "1,234.56" -> 1234.56;  "--" / "" -> null
function num(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/,/g, '').trim();
  if (s === '' || s === '--' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "0.09%" -> 0.09 (kept as percent value, not fraction)
function pct(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/%/g, '').replace(/,/g, '').trim();
  if (s === '' || s === '--') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// "February 1, 2026 - April 30, 2026" -> { start: '2026-02-01', end: '2026-04-30' }
function parseDateRange(label) {
  const m = label.match(/^(.+?)\s*-\s*(.+)$/);
  if (!m) return { start: null, end: null };
  return { start: toIso(m[1]), end: toIso(m[2]) };
}

const MONTHS = {
  january:1, february:2, march:3, april:4, may:5, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
};
function toIso(s) {
  const slash = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[3]}-${String(+slash[1]).padStart(2,'0')}-${String(+slash[2]).padStart(2,'0')}`;
  }
  const m = s.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mm = MONTHS[m[1].toLowerCase()];
    if (mm) return `${m[3]}-${String(mm).padStart(2,'0')}-${String(+m[2]).padStart(2,'0')}`;
  }
  // Fallback for already-ISO or other parseable forms (avoid TZ shift by reading UTC parts).
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

module.exports = { readReport, num, pct, parseDateRange };
