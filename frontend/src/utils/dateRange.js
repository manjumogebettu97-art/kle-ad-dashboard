import { platformLabel } from './format';

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateValue(value) {
  return value ? String(value).slice(0, 10) : '';
}

export function daysInclusive(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) return 0;
  return Math.floor((endDate - startDate) / DAY_MS) + 1;
}

export function clampDateValue(value, min, max) {
  if (!value) return min || max || '';
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

export function scaleNumber(value, factor, decimals = 0) {
  const number = Number(value || 0) * factor;
  if (!Number.isFinite(number)) return 0;
  return decimals > 0 ? Number(number.toFixed(decimals)) : Math.round(number);
}

export function scaleMetricRow(row = {}, factor = 1) {
  const source = row || {};
  const scaled = { ...source };
  const wholeFields = [
    'impressions',
    'clicks',
    'conversions',
    'viewable_impressions',
    'trueview_views',
    'interactions',
  ];
  const decimalFields = ['cost'];

  wholeFields.forEach((field) => {
    if (field in source) scaled[field] = scaleNumber(source[field], factor);
  });
  decimalFields.forEach((field) => {
    if (field in source) scaled[field] = scaleNumber(source[field], factor, 2);
  });

  return recalculateDerivedMetrics(scaled);
}

export function dailyMetricFactors(rows, startDate, endDate) {
  if (!rows?.length || !startDate || !endDate) return null;
  const fields = ['impressions', 'clicks', 'cost', 'viewable_impressions', 'reach'];
  const totals = fields.reduce((acc, field) => ({ ...acc, [field]: 0 }), {});
  const selected = fields.reduce((acc, field) => ({ ...acc, [field]: 0 }), {});

  rows.forEach((row) => {
    fields.forEach((field) => {
      totals[field] += Number(row[field] || 0);
    });
    if (row.date >= startDate && row.date <= endDate) {
      fields.forEach((field) => {
        selected[field] += Number(row[field] || 0);
      });
    }
  });

  return fields.reduce((acc, field) => {
    acc[field] = totals[field] ? selected[field] / totals[field] : null;
    return acc;
  }, {});
}

export function scaleMetricRowWithFactors(row = {}, factors, fallbackFactor = 1) {
  if (!factors) return scaleMetricRow(row, fallbackFactor);
  const source = row || {};
  const scaled = { ...source };
  const fieldFactors = {
    impressions: factors.impressions,
    clicks: factors.clicks,
    cost: factors.cost,
    conversions: factors.clicks ?? factors.cost,
    viewable_impressions: factors.viewable_impressions,
    trueview_views: factors.viewable_impressions,
    interactions: factors.clicks ?? factors.impressions,
  };

  Object.entries(fieldFactors).forEach(([field, factor]) => {
    if (!(field in source)) return;
    const useFactor = factor ?? fallbackFactor;
    scaled[field] = field === 'cost'
      ? scaleNumber(source[field], useFactor, 2)
      : scaleNumber(source[field], useFactor);
  });

  return recalculateDerivedMetrics(scaled);
}

function recalculateDerivedMetrics(row) {
  const impressions = Number(row.impressions || 0);
  const clicks = Number(row.clicks || 0);
  const cost = Number(row.cost || 0);
  const conversions = Number(row.conversions || 0);
  const views = Number(row.viewable_impressions || 0);
  const trueviewViews = Number(row.trueview_views ?? row.viewable_impressions ?? 0);

  if ('ctr' in row) row.ctr = impressions ? Number((clicks * 100 / impressions).toFixed(2)) : 0;
  if ('cpc' in row) row.cpc = clicks ? Number((cost / clicks).toFixed(2)) : 0;
  if ('avg_cpc' in row) row.avg_cpc = clicks ? Number((cost / clicks).toFixed(2)) : 0;
  if ('cpm' in row) row.cpm = impressions ? Number((cost * 1000 / impressions).toFixed(2)) : 0;
  if ('avg_cpm' in row) row.avg_cpm = impressions ? Number((cost * 1000 / impressions).toFixed(2)) : 0;
  if ('viewable_ctr' in row) {
    row.viewable_ctr = row.sub_platform === 'video'
      ? (impressions ? Number((views * 100 / impressions).toFixed(2)) : 0)
      : (views ? Number((clicks * 100 / views).toFixed(2)) : 0);
  }
  if ('trueview_view_rate' in row) row.trueview_view_rate = impressions ? Number((trueviewViews * 100 / impressions).toFixed(2)) : 0;
  if ('trueview_cpv' in row) row.trueview_cpv = trueviewViews ? Number((cost / trueviewViews).toFixed(2)) : 0;
  if ('conv_rate' in row) row.conv_rate = clicks ? Number((conversions * 100 / clicks).toFixed(2)) : 0;
  if ('cost_per_conv' in row) row.cost_per_conv = conversions ? Number((cost / conversions).toFixed(2)) : 0;

  return row;
}

export function buildRangeMeta(period, selectedStart, selectedEnd) {
  const minDate = toDateValue(period?.start_date);
  const maxDate = toDateValue(period?.end_date);
  const startDate = clampDateValue(selectedStart || minDate, minDate, maxDate);
  const endDate = clampDateValue(selectedEnd || maxDate, startDate || minDate, maxDate);
  const selectedDays = daysInclusive(startDate, endDate);
  const importedDays = daysInclusive(minDate, maxDate) || selectedDays || 1;
  const factor = importedDays && selectedDays ? Math.min(1, selectedDays / importedDays) : 1;
  const label = startDate && endDate
    ? `${formatRangeDate(startDate)} - ${formatRangeDate(endDate)}`
    : 'Select date range';

  return {
    startDate,
    endDate,
    minDate,
    maxDate,
    selectedDays,
    importedDays,
    factor,
    label,
  };
}

export function formatRangeDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function shortViewLabel(view) {
  if (view.platform === 'google' && view.sub_platform === 'video') return 'YouTube Ads';
  if (view.platform === 'google' && view.sub_platform === 'display') return 'Display Ads';
  if (view.platform === 'linkedin' && view.sub_platform === 'video') return 'Video Ads';
  if (view.platform === 'linkedin' && view.sub_platform === 'image') return 'Image Ads';
  return platformLabel(view.platform, view.sub_platform);
}
