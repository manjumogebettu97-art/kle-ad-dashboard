export function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString();
}

// 1234567 → "1.2M"; 12500 → "12.5K"; 950 → "950"
export function compact(n) {
  if (n === null || n === undefined) return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e9) return trim(v / 1e9) + 'B';
  if (abs >= 1e6) return trim(v / 1e6) + 'M';
  if (abs >= 1e3) return trim(v / 1e3) + 'K';
  return String(v);
}

function trim(n) {
  return Number(n.toFixed(1)).toString();
}

export function compactMoney(n, currency) {
  if (n === null || n === undefined) return '—';
  const sym = ({ INR: '₹', USD: '$', EUR: '€', GBP: '£' })[currency] || (currency ? currency + ' ' : '');
  return `${sym}${compact(n)}`;
}

const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export function money(n, currency) {
  if (n === null || n === undefined) return '—';
  const sym = SYMBOLS[currency] || (currency ? currency + ' ' : '');
  return `${sym}${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pct(n) {
  if (n === null || n === undefined) return '—';
  return `${Number(n).toFixed(2)}%`;
}

export function pctOrDash(n) {
  if (n === null || n === undefined) return '—';
  return Number(n) > 0 ? pct(n) : '-';
}

// Google location export prefixes like "3.0|km|<name>" — strip the radius for display.
export function cleanLocation(s) {
  if (!s) return s;
  const m = s.match(/^[\d.]+\|km\|(.+)$/i);
  return m ? m[1] : s;
}

export function platformLabel(platform, subPlatform) {
  const labels = {
    'google-display': 'Google Display Ads',
    'google-video': 'Google YouTube Ads',
    'linkedin-image': 'LinkedIn Image Ads',
    'linkedin-video': 'LinkedIn Video Ads',
    'linkedin-sponsored': 'LinkedIn Sponsored Ads',
  };
  const key = `${platform}-${subPlatform}`;
  if (labels[key]) return labels[key];

  const p = platform === 'google' ? 'Google Ads' : platform === 'linkedin' ? 'LinkedIn Ads' : platform;
  const s = subPlatform ? subPlatform.charAt(0).toUpperCase() + subPlatform.slice(1) : '';
  return s ? `${p} ${s}` : p;
}
