const express = require('express');
const fs      = require('fs');
const path    = require('path');
const db      = require('../db/schema');
const { authenticate } = require('../middleware/auth');
const { generateYoutubeDaily } = require('../utils/youtubeDaily');

const router = express.Router();
const EDUCATION_COMPANIES_FILE = path.join(__dirname, '../../data/imports/linkedin-sponsored/education-companies.csv');

router.use(authenticate);

/**
 * GET /api/dashboard/periods
 * List of imported periods (with platform/sub-platform + counts).
 */
router.get('/periods', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      p.id,
      p.platform,
      p.sub_platform,
      p.label,
      p.start_date,
      p.end_date,
      p.currency,
      p.imported_at,
      (SELECT COUNT(*) FROM campaign_metrics  WHERE period_id = p.id) AS campaign_count,
      (SELECT COUNT(*) FROM location_metrics  WHERE period_id = p.id) AS location_count,
      (SELECT COUNT(*) FROM ad_creatives      WHERE period_id = p.id) AS ad_count,
      (SELECT COUNT(*) FROM placement_metrics WHERE period_id = p.id) AS placement_count
    FROM periods p
    ORDER BY p.end_date DESC, p.id DESC
  `).all();
  res.json(rows);
});

/**
 * GET /api/dashboard/summary?period=<id>
 * If period omitted: aggregate across all periods.
 * Returns per-platform totals + grand total.
 */
router.get('/summary', (req, res) => {
  const periodId    = req.query.period ? Number(req.query.period) : null;
  const platform    = req.query.platform;
  const subPlatform = req.query.sub_platform;

  // Per-platform aggregates from campaign_metrics joined with periods.
  const conds = [];
  const params = [];
  if (periodId)    { conds.push('p.id = ?');           params.push(periodId); }
  if (platform)    { conds.push('p.platform = ?');     params.push(platform); }
  if (subPlatform) { conds.push('p.sub_platform = ?'); params.push(subPlatform); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT
      p.platform,
      p.sub_platform,
      p.currency,
      SUM(cm.impressions) AS impressions,
      SUM(cm.clicks)      AS clicks,
      ROUND(SUM(cm.cost), 2) AS cost,
      SUM(cm.conversions) AS conversions,
      SUM(cm.viewable_impressions) AS viewable_impressions,
      CASE WHEN SUM(cm.impressions) = 0 THEN 0
           ELSE ROUND(SUM(cm.clicks) * 100.0 / SUM(cm.impressions), 2) END AS ctr,
      CASE WHEN SUM(cm.clicks) = 0 THEN 0
           ELSE ROUND(SUM(cm.cost) / SUM(cm.clicks), 2) END AS cpc,
      CASE WHEN SUM(cm.impressions) = 0 THEN 0
           ELSE ROUND(SUM(cm.cost) * 1000.0 / SUM(cm.impressions), 2) END AS cpm
    FROM periods p
    LEFT JOIN campaign_metrics cm ON cm.period_id = p.id
    ${where}
    GROUP BY p.platform, p.sub_platform, p.currency
  `).all(...params);

  const total = rows.reduce(
    (acc, r) => {
      acc.impressions += r.impressions || 0;
      acc.clicks      += r.clicks      || 0;
      acc.cost        += r.cost        || 0;
      acc.conversions += r.conversions || 0;
      acc.viewable_impressions += r.viewable_impressions || 0;
      return acc;
    },
    { impressions: 0, clicks: 0, cost: 0, conversions: 0, viewable_impressions: 0 }
  );
  total.ctr = total.impressions ? +(total.clicks * 100 / total.impressions).toFixed(2) : 0;
  total.cpc = total.clicks      ? +(total.cost  / total.clicks).toFixed(2)             : 0;
  total.cpm = total.impressions ? +(total.cost * 1000 / total.impressions).toFixed(2)  : 0;
  total.platform = 'all';

  // Currency: pick the period's if a single period; otherwise first non-null.
  const currency = rows.find((r) => r.currency)?.currency || null;

  res.json({ platforms: rows, total, currency });
});

/**
 * GET /api/dashboard/daily?period=<id>
 * Daily YouTube curve used for Google Ads-style performance charts.
 */
router.get('/daily', (req, res) => {
  const periodId = req.query.period ? Number(req.query.period) : null;
  if (!periodId) return res.json({ rows: [] });

  const period = db.prepare(`
    SELECT id, platform, sub_platform, start_date, end_date, currency
    FROM periods
    WHERE id = ?
  `).get(periodId);

  if (!period || period.platform !== 'google' || period.sub_platform !== 'video') {
    return res.json({ rows: [] });
  }

  const totals = db.prepare(`
    SELECT
      SUM(cm.impressions) AS impressions,
      SUM(cm.clicks) AS clicks,
      ROUND(SUM(cm.cost), 2) AS cost,
      SUM(cm.viewable_impressions) AS viewable_impressions
    FROM campaign_metrics cm
    WHERE cm.period_id = ?
  `).get(period.id);

  res.json({
    rows: generateYoutubeDaily(period, {
      impressions: totals?.impressions || 0,
      clicks: totals?.clicks || 0,
      cost: totals?.cost || 0,
      viewable_impressions: totals?.viewable_impressions || 0,
    }),
    currency: period.currency,
  });
});

/**
 * GET /api/dashboard/campaigns?period=<id>&platform=<google|linkedin>
 */
router.get('/campaigns', (req, res) => {
  const periodId    = req.query.period ? Number(req.query.period) : null;
  const platform    = req.query.platform;
  const subPlatform = req.query.sub_platform;

  const conds = [];
  const params = [];
  if (periodId)    { conds.push('p.id = ?');           params.push(periodId); }
  if (platform)    { conds.push('p.platform = ?');     params.push(platform); }
  if (subPlatform) { conds.push('p.sub_platform = ?'); params.push(subPlatform); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT
      cm.id,
      p.platform,
      p.sub_platform,
      p.label AS period_label,
      p.currency,
      cm.campaign_name,
      cm.campaign_status,
      cm.status_detail,
      cm.impressions,
      cm.clicks,
      cm.cost,
      cm.avg_cpm,
      cm.avg_cpc,
      cm.ctr,
      cm.viewable_impressions,
      cm.viewable_ctr,
      cm.avg_viewable_cpm,
      cm.conversions,
      cm.conv_rate,
      cm.cost_per_conv
    FROM campaign_metrics cm
    JOIN periods p ON p.id = cm.period_id
    ${where}
    ORDER BY cm.cost DESC, cm.impressions DESC
  `).all(...params);

  res.json(rows);
});

/**
 * GET /api/dashboard/locations?period=<id>&platform=<>&sortBy=<col>&order=<asc|desc>&limit=<n>&offset=<n>
 */
router.get('/locations', (req, res) => {
  const periodId    = req.query.period ? Number(req.query.period) : null;
  const platform    = req.query.platform;
  const subPlatform = req.query.sub_platform;
  const sortBy      = sanitizeSort(req.query.sortBy);
  const order       = (req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const limit       = Math.min(Number(req.query.limit)  || 100, 500);
  const offset      = Math.max(Number(req.query.offset) || 0, 0);

  const conds = [];
  const params = [];
  if (periodId)    { conds.push('p.id = ?');           params.push(periodId); }
  if (platform)    { conds.push('p.platform = ?');     params.push(platform); }
  if (subPlatform) { conds.push('p.sub_platform = ?'); params.push(subPlatform); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT
      lm.id,
      p.platform,
      p.sub_platform,
      p.currency,
      lm.location,
      lm.bid_adjustment,
      lm.impressions,
      lm.clicks,
      lm.cost,
      lm.ctr,
      lm.avg_cpm,
      lm.avg_cpc,
      lm.interactions,
      lm.interaction_rate,
      lm.trueview_views,
      lm.trueview_cpv,
      lm.trueview_view_rate,
      lm.conversions,
      lm.conv_rate,
      lm.cost_per_conv
    FROM location_metrics lm
    JOIN periods p ON p.id = lm.period_id
    ${where}
    ORDER BY ${sortBy} ${order}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const totalRow = db.prepare(`
    SELECT
      COUNT(*) AS total_rows,
      SUM(lm.impressions) AS impressions,
      SUM(lm.clicks)      AS clicks,
      ROUND(SUM(lm.cost), 2) AS cost,
      SUM(lm.trueview_views) AS trueview_views,
      SUM(lm.conversions) AS conversions
    FROM location_metrics lm
    JOIN periods p ON p.id = lm.period_id
    ${where}
  `).get(...params);

  res.json({ rows, totals: totalRow });
});

const ALLOWED_SORTS = new Set([
  'impressions', 'clicks', 'cost', 'ctr', 'avg_cpc', 'avg_cpm',
  'interactions', 'conversions', 'cost_per_conv', 'location',
]);
function sanitizeSort(s) {
  return ALLOWED_SORTS.has(s) ? `lm.${s}` : 'lm.impressions';
}

/**
 * GET /api/dashboard/ads?period=<id>&sortBy=<col>&order=<asc|desc>
 */
router.get('/ads', (req, res) => {
  const periodId    = req.query.period ? Number(req.query.period) : null;
  const platform    = req.query.platform;
  const subPlatform = req.query.sub_platform;
  const sortBy      = sanitizeAdSort(req.query.sortBy);
  const order       = (req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const conds = [];
  const params = [];
  if (periodId)    { conds.push('p.id = ?');           params.push(periodId); }
  if (platform)    { conds.push('p.platform = ?');     params.push(platform); }
  if (subPlatform) { conds.push('p.sub_platform = ?'); params.push(subPlatform); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT
      a.id,
      p.platform,
      p.sub_platform,
      p.currency,
      p.source_dir,
      a.campaign_name,
      a.ad_group,
      a.ad_name,
      a.ad_type,
      a.ad_status,
      a.image_filename,
      a.image_size,
      a.impressions,
      a.clicks,
      a.cost,
      a.ctr,
      a.avg_cpc,
      a.avg_cpm,
      a.viewable_impressions,
      a.viewable_ctr,
      a.avg_viewable_cpm,
      a.conversions,
      a.conv_rate,
      a.cost_per_conv
    FROM ad_creatives a
    JOIN periods p ON p.id = a.period_id
    ${where}
    ORDER BY ${sortBy} ${order}
  `).all(...params);

  res.json(rows);
});

const ALLOWED_AD_SORTS = new Set([
  'impressions', 'clicks', 'cost', 'ctr', 'avg_cpc', 'avg_cpm',
  'viewable_impressions', 'viewable_ctr', 'conversions', 'ad_name',
]);
function sanitizeAdSort(s) {
  return ALLOWED_AD_SORTS.has(s) ? `a.${s}` : 'a.impressions';
}

/**
 * GET /api/dashboard/placements
 *   ?period=<id> &platform=<google|linkedin> &type=<Mobile application|Site|YouTube video|...>
 *   &sortBy=<col> &order=<asc|desc> &limit=<n> &offset=<n>
 *
 * "Targeted content" / placement report — where Display ads were actually shown.
 */
router.get('/placements', (req, res) => {
  const periodId    = req.query.period ? Number(req.query.period) : null;
  const platform    = req.query.platform;
  const subPlatform = req.query.sub_platform;
  const type        = req.query.type;
  const sortBy      = sanitizePlacementSort(req.query.sortBy);
  const order       = (req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const limit       = Math.min(Number(req.query.limit)  || 200, 1000);
  const offset      = Math.max(Number(req.query.offset) || 0, 0);

  const conds = [];
  const params = [];
  if (periodId)    { conds.push('p.id = ?');               params.push(periodId); }
  if (platform)    { conds.push('p.platform = ?');         params.push(platform); }
  if (subPlatform) { conds.push('p.sub_platform = ?');     params.push(subPlatform); }
  if (type)        { conds.push('pm.placement_type = ?');  params.push(type); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT
      pm.id,
      p.platform,
      p.sub_platform,
      p.currency,
      pm.placement,
      pm.placement_url,
      pm.placement_type,
      pm.campaign_name,
      pm.ad_group,
      pm.impressions,
      pm.clicks,
      pm.cost,
      pm.ctr,
      pm.avg_cpm,
      pm.trueview_views,
      pm.trueview_cpv,
      pm.trueview_view_rate
    FROM placement_metrics pm
    JOIN periods p ON p.id = pm.period_id
    ${where}
    ORDER BY ${sortBy} ${order}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const totals = db.prepare(`
    SELECT
      COUNT(*)              AS total_rows,
      SUM(pm.impressions)   AS impressions,
      SUM(pm.clicks)        AS clicks,
      ROUND(SUM(pm.cost),2) AS cost,
      SUM(pm.trueview_views) AS trueview_views
    FROM placement_metrics pm
    JOIN periods p ON p.id = pm.period_id
    ${where}
  `).get(...params);

  const byType = db.prepare(`
    SELECT
      pm.placement_type     AS type,
      COUNT(*)              AS rows_count,
      SUM(pm.impressions)   AS impressions,
      SUM(pm.clicks)        AS clicks,
      ROUND(SUM(pm.cost),2) AS cost,
      SUM(pm.trueview_views) AS trueview_views
    FROM placement_metrics pm
    JOIN periods p ON p.id = pm.period_id
    ${where}
    GROUP BY pm.placement_type
    ORDER BY impressions DESC
  `).all(...params);

  res.json({ rows, totals, byType });
});

/**
 * GET /api/dashboard/highlights?period=<id>&platform=<>
 * Top performer in each dimension for the period.
 */
router.get('/highlights', (req, res) => {
  const periodId    = req.query.period ? Number(req.query.period) : null;
  const platform    = req.query.platform;
  const subPlatform = req.query.sub_platform;

  const conds = [];
  const params = [];
  if (periodId)    { conds.push('p.id = ?');           params.push(periodId); }
  if (platform)    { conds.push('p.platform = ?');     params.push(platform); }
  if (subPlatform) { conds.push('p.sub_platform = ?'); params.push(subPlatform); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  // Top location by impressions (then cost as tiebreaker).
  const topLocation = db.prepare(`
    SELECT
      lm.location, lm.impressions, lm.clicks, lm.ctr, lm.cost, lm.avg_cpc,
      lm.conversions, p.currency
    FROM location_metrics lm
    JOIN periods p ON p.id = lm.period_id
    ${where}
    ORDER BY lm.impressions DESC, lm.cost DESC
    LIMIT 1
  `).get(...params);

  // Top ad by impressions (must have an image to be useful).
  const topAd = db.prepare(`
    SELECT
      a.ad_name, a.image_filename, a.image_size, a.campaign_name, a.ad_group,
      a.impressions, a.clicks, a.ctr, a.cost, a.avg_cpc, a.avg_cpm,
      p.currency, p.source_dir
    FROM ad_creatives a
    JOIN periods p ON p.id = a.period_id
    ${where}
    ORDER BY a.impressions DESC, a.cost DESC
    LIMIT 1
  `).get(...params);

  // Best ad by CTR (min 100 impr to avoid noise).
  const bestCtrConds = [...conds, 'a.impressions >= 100'];
  const bestCtrWhere = 'WHERE ' + bestCtrConds.join(' AND ');
  const topAdByCtr = db.prepare(`
    SELECT
      a.ad_name, a.image_filename, a.campaign_name,
      a.impressions, a.clicks, a.ctr, a.cost,
      p.currency, p.source_dir
    FROM ad_creatives a
    JOIN periods p ON p.id = a.period_id
    ${bestCtrWhere}
    ORDER BY a.ctr DESC, a.impressions DESC
    LIMIT 1
  `).get(...params);

  // Top placement by impressions.
  const topPlacement = db.prepare(`
    SELECT
      pm.placement, pm.placement_url, pm.placement_type, pm.campaign_name,
      pm.impressions, pm.clicks, pm.ctr, pm.cost, pm.avg_cpm,
      pm.trueview_views, pm.trueview_cpv, pm.trueview_view_rate,
      p.currency
    FROM placement_metrics pm
    JOIN periods p ON p.id = pm.period_id
    ${where}
    ORDER BY pm.impressions DESC
    LIMIT 1
  `).get(...params);

  res.json({ topLocation, topAd, topAdByCtr, topPlacement });
});

/**
 * GET /api/dashboard/companies?segment=education
 * Education-related companies from LinkedIn's company export where ads appeared.
 */
router.get('/companies', (req, res) => {
  const segment = req.query.segment || 'education';
  const limit = Math.min(Number(req.query.limit) || 500, 1000);
  if (segment !== 'education') return res.json({ rows: [], totals: { total_rows: 0 } });
  if (!fs.existsSync(EDUCATION_COMPANIES_FILE)) {
    return res.json({ rows: [], totals: { total_rows: 0 } });
  }

  const parsed = parseCSV(fs.readFileSync(EDUCATION_COMPANIES_FILE, 'utf8').replace(/^\uFEFF/, ''));
  const [headers, ...body] = parsed;
  const rows = body
    .map((cols) => {
      const row = Object.fromEntries(headers.map((header, index) => [header, cols[index] || '']));
      return {
        company_name: row['Company Name'],
        company_page_url: row['Company Page URL'],
        engagement_level: row['Engagement Level'],
        organic_impressions: toNumber(row['Organic Impressions']),
        organic_engagements: toNumber(row['Organic Engagements']),
        paid_impressions: toNumber(row['Paid Impressions']),
        paid_clicks: toNumber(row['Paid Clicks']),
        paid_engagements: toNumber(row['Paid Engagements']),
        paid_video_views: toNumber(row['Paid Video Views']),
        paid_conversions: toNumber(row['Paid Conversions']),
        paid_leads: toNumber(row['Paid Leads']),
      };
    })
    .sort((a, b) => b.paid_impressions - a.paid_impressions);

  const totals = rows.reduce((acc, row) => {
    acc.total_rows += 1;
    acc.paid_impressions += row.paid_impressions || 0;
    acc.paid_clicks += row.paid_clicks || 0;
    acc.paid_engagements += row.paid_engagements || 0;
    acc.paid_video_views += row.paid_video_views || 0;
    return acc;
  }, { total_rows: 0, paid_impressions: 0, paid_clicks: 0, paid_engagements: 0, paid_video_views: 0 });

  res.json({ rows: rows.slice(0, limit), totals });
});

const ALLOWED_PLACEMENT_SORTS = new Set([
  'impressions', 'clicks', 'cost', 'ctr', 'avg_cpm',
  'trueview_views', 'trueview_cpv', 'trueview_view_rate',
  'placement', 'placement_type', 'campaign_name',
]);
function sanitizePlacementSort(s) {
  return ALLOWED_PLACEMENT_SORTS.has(s) ? `pm.${s}` : 'pm.impressions';
}

function toNumber(value) {
  return Number(String(value || '').replace(/,/g, '')) || 0;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

module.exports = router;
