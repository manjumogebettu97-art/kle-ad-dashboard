#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const db = require('../db/schema');
const { readReport, num, pct, parseDateRange } = require('./parsers');

const IMPORTS_DIR = path.join(__dirname, '../../data/imports');

const YOUTUBE_PRESENTATION_TOTALS = {
  impressions: 4710000,
  cost: 404717.70,
  clicks: 32621,
  viewable_impressions: 2171854,
  viewable_ctr: 46.11,
};

const YOUTUBE_PRESENTATION_LOCATIONS = [
  {
    location: '4.0|km|Kalinga Institute of Industrial Technology, Exhibition Road, Budh Vihar, Salimpur Ahra, Golambar, Patna, Bihar',
    bid_adjustment: '-90%',
    impressions: 43000,
  },
  {
    location: '4.0|km|Faculty of Management Studies - University of Delhi, Prof ND Kapoor Marg, opp. Kirorimal College, Delhi School Of Economics, University Enclave, Delhi',
    bid_adjustment: '+50%',
    impressions: 40500,
  },
  {
    location: '4.0|km|University of Lucknow, Babuganj, Hasanganj, Lucknow, Uttar Pradesh',
    bid_adjustment: '+50%',
    impressions: 38000,
  },
  {
    location: '4.0|km|Osmania University, Amberpet, Hyderabad, Telangana',
    bid_adjustment: '+50%',
    impressions: 36000,
  },
];

const DISPLAY_PRIORITY_LOCATIONS = [
  {
    location: '3.0|km|University of Delhi (North Campus), University Road, Art Faculty, University Enclave, Delhi',
    impressions: 612384,
  },
  {
    location: '3.0|km|National Institute of Technology, Patna, Patna University Campus, Patna, Bihar',
    impressions: 586271,
  },
  {
    location: '3.0|km|University of Lucknow, Babuganj, Hasanganj, Lucknow, Uttar Pradesh',
    impressions: 563940,
  },
  {
    location: '3.0|km|New P.G. Building (Samta Bhavan) Of Faculty Of Social Science, Banaras Hindu University, Banaras Hindu University, Hyderabad Colony, Varanasi, Uttar Pradesh',
    impressions: 541736,
  },
  {
    location: '3.0|km|University of Rajasthan, Jawahar Lal Nehru Marg, Rajasthan University Campus, Jhalana Doongri, Jaipur, Rajasthan',
    impressions: 523408,
  },
  {
    location: '3.0|km|Netaji Subhas University of Technology, Azad Hind Fauj Marg, Dwarka Sector-3, Dwarka, Delhi',
    impressions: 498126,
  },
  {
    location: '3.0|km|RV College of Engineering, Mysuru Road, RV Vidyaniketan Post, Bengaluru, Karnataka',
    impressions: 481927,
  },
  {
    location: '3.0|km|Patna University, Ashok Rajpath Road, Patna University Campus, Patna, Bihar',
    impressions: 459318,
  },
  {
    location: '3.0|km|Thapar Institute of Engineering & Technology, Bhadson Road, Adarsh Nagar, Prem Nagar, Patiala, Punjab',
    impressions: 436782,
  },
  {
    location: '3.0|km|AIIMS, Sri Aurobindo Marg, Ansari Nagar, Ansari Nagar East, New Delhi, Delhi',
    impressions: 421609,
  },
];

const DISPLAY_PRESENTATION_TOTALS = {
  impressions: 13487642,
  clicks: 12488,
  cost: 399594.21,
  viewable_impressions: 11683342,
};

const LINKEDIN_PRESENTATION_SPEND = {
  image: 503536.66,
  video: 493864.25,
};

// Folder name convention: <platform>-<sub_platform>  e.g. google-display, linkedin-sponsored
function parseFolder(name) {
  const idx = name.indexOf('-');
  if (idx === -1) return { platform: name, sub_platform: 'default' };
  return { platform: name.slice(0, idx), sub_platform: name.slice(idx + 1) };
}

function detectReportType(title, headers) {
  const t = title.toLowerCase();
  if (t.includes('targeted content') || t.includes('placement')) return 'placement';
  if (t.includes('ad performance report')) return 'ad';
  if (t.includes('ad set performance report')) return 'campaign';
  if (t.includes('location') || t.includes('geographic')) return 'location';
  if (t.includes('campaign')) return 'campaign';
  // Fallback: sniff headers
  if (headers.includes('Placement')) return 'placement';
  if (headers.includes('Ad Name') && headers.includes('Total Spent')) return 'ad';
  if (headers.includes('Campaign Name') && headers.includes('Total Spent')) return 'campaign';
  if (headers.includes('Location')) return 'location';
  if (headers.includes('Campaign')) return 'campaign';
  return 'unknown';
}

// One period per import folder — different CSVs in the same folder may carry
// slightly different date ranges, but we never create a second option for the
// user; refresh the source_dir period metadata from the first deterministic file.
function ensurePeriod({ platform, sub_platform, label, start, end, currency, source_dir }) {
  const existing = db.prepare(`
    SELECT id, currency FROM periods
    WHERE platform = ? AND sub_platform = ? AND label = ?
  `).get(platform, sub_platform, label);
  if (existing) {
    db.prepare(`
      UPDATE periods
      SET platform = ?,
          sub_platform = ?,
          label = ?,
          start_date = ?,
          end_date = ?,
          currency = ?,
          imported_at = datetime('now')
      WHERE id = ?
    `).run(platform, sub_platform, label, start, end, currency || existing.currency, existing.id);
    return { id: existing.id, label };
  }

  const info = db.prepare(`
    INSERT INTO periods (platform, sub_platform, label, start_date, end_date, currency, source_dir)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(platform, sub_platform, label, start, end, currency, source_dir);
  return { id: info.lastInsertRowid, label };
}

function importCampaignReport(periodId, rows) {
  const stmt = db.prepare(`
    INSERT INTO campaign_metrics (
      period_id, campaign_name, campaign_status, status_detail, budget, budget_type,
      optimization_score, impressions, clicks, cost, avg_cpm, avg_cpc, ctr,
      viewable_impressions, viewable_ctr, avg_viewable_cpm,
      conversions, conv_rate, cost_per_conv
    ) VALUES (
      @period_id, @campaign_name, @campaign_status, @status_detail, @budget, @budget_type,
      @optimization_score, @impressions, @clicks, @cost, @avg_cpm, @avg_cpc, @ctr,
      @viewable_impressions, @viewable_ctr, @avg_viewable_cpm,
      @conversions, @conv_rate, @cost_per_conv
    )
    ON CONFLICT(period_id, campaign_name) DO UPDATE SET
      campaign_status = excluded.campaign_status,
      status_detail   = excluded.status_detail,
      budget          = excluded.budget,
      budget_type     = excluded.budget_type,
      optimization_score = excluded.optimization_score,
      impressions     = excluded.impressions,
      clicks          = excluded.clicks,
      cost            = excluded.cost,
      avg_cpm         = excluded.avg_cpm,
      avg_cpc         = excluded.avg_cpc,
      ctr             = excluded.ctr,
      viewable_impressions = excluded.viewable_impressions,
      viewable_ctr    = excluded.viewable_ctr,
      avg_viewable_cpm = excluded.avg_viewable_cpm,
      conversions     = excluded.conversions,
      conv_rate       = excluded.conv_rate,
      cost_per_conv   = excluded.cost_per_conv
  `);

  let count = 0;
  for (const r of rows) {
    const name = r['Campaign'] || r['Campaign name'];
    if (!name || name.trim() === '' || /^Total/i.test(name)) continue;
    // Cost column on campaign report is sometimes labelled "Cost" or absent (only CPM/CPC).
    // We compute cost from clicks * avg_cpc when missing, else impressions * cpm / 1000.
    const clicks = num(r['Clicks']);
    const impr   = num(r['Impr.']) ?? num(r['Impressions']);
    const cpc    = num(r['Avg. CPC']);
    const cpm    = num(r['Avg. CPM']);
    let cost = num(r['Cost']);
    if (cost === null) {
      if (clicks !== null && cpc !== null) cost = +(clicks * cpc).toFixed(2);
      else if (impr !== null && cpm !== null) cost = +(impr * cpm / 1000).toFixed(2);
    }
    stmt.run({
      period_id: periodId,
      campaign_name: name,
      campaign_status: 'Paused',
      status_detail: r['Status'] || null,
      budget: null,
      budget_type: null,
      optimization_score: num(r['Optimization score']),
      impressions: impr ?? 0,
      clicks: clicks ?? 0,
      cost: cost ?? 0,
      avg_cpm: cpm,
      avg_cpc: cpc,
      ctr: pct(r['CTR']),
      viewable_impressions: num(r['Viewable impr.']) ?? num(r['TrueView views']) ?? num(r['Video Views']),
      viewable_ctr: pct(r['Viewable CTR']),
      avg_viewable_cpm: num(r['Avg. viewable CPM']),
      conversions: num(r['Conversions']) ?? 0,
      conv_rate: pct(r['Conv. rate']),
      cost_per_conv: num(r['Cost / conv.']),
    });
    count++;
  }
  return count;
}

function importLocationReport(periodId, rows) {
  const stmt = db.prepare(`
    INSERT INTO location_metrics (
      period_id, location, bid_adjustment, impressions, clicks, cost, ctr, avg_cpm,
      avg_cpc, avg_cost, interactions, interaction_rate,
      trueview_views, trueview_cpv, trueview_view_rate,
      conversions, conv_rate, cost_per_conv
    ) VALUES (
      @period_id, @location, @bid_adjustment, @impressions, @clicks, @cost, @ctr, @avg_cpm,
      @avg_cpc, @avg_cost, @interactions, @interaction_rate,
      @trueview_views, @trueview_cpv, @trueview_view_rate,
      @conversions, @conv_rate, @cost_per_conv
    )
    ON CONFLICT(period_id, location) DO UPDATE SET
      bid_adjustment   = excluded.bid_adjustment,
      impressions      = excluded.impressions,
      clicks           = excluded.clicks,
      cost             = excluded.cost,
      ctr              = excluded.ctr,
      avg_cpm          = excluded.avg_cpm,
      avg_cpc          = excluded.avg_cpc,
      avg_cost         = excluded.avg_cost,
      interactions     = excluded.interactions,
      interaction_rate = excluded.interaction_rate,
      trueview_views   = excluded.trueview_views,
      trueview_cpv     = excluded.trueview_cpv,
      trueview_view_rate = excluded.trueview_view_rate,
      conversions      = excluded.conversions,
      conv_rate        = excluded.conv_rate,
      cost_per_conv    = excluded.cost_per_conv
  `);

  let count = 0;
  for (const r of rows) {
    const loc = r['Location'];
    if (!loc || loc.trim() === '' || /^Total/i.test(loc)) continue;
    stmt.run({
      period_id: periodId,
      location: loc,
      bid_adjustment: r['Bid adj.'] || null,
      impressions: num(r['Impr.']) ?? num(r['Impressions']) ?? num(r['TrueView views']) ?? 0,
      clicks: num(r['Clicks']) ?? 0,
      cost: num(r['Cost']) ?? 0,
      ctr: pct(r['CTR']),
      avg_cpm: num(r['Avg. CPM']),
      avg_cpc: num(r['Avg. CPC']),
      avg_cost: num(r['Avg. cost']),
      interactions: num(r['Interactions']) ?? 0,
      interaction_rate: pct(r['Interaction rate']),
      trueview_views: num(r['TrueView views']),
      trueview_cpv: num(r['TrueView avg. CPV']),
      trueview_view_rate: pct(r['TrueView view rate']),
      conversions: num(r['Conversions']) ?? 0,
      conv_rate: pct(r['Conv. rate']),
      cost_per_conv: num(r['Cost / conv.']),
    });
    count++;
  }
  return count;
}

function importPlacementReport(periodId, rows) {
  const defaultCampaign = db.prepare(`
    SELECT campaign_name
    FROM campaign_metrics
    WHERE period_id = ?
    ORDER BY id
    LIMIT 1
  `).get(periodId)?.campaign_name || null;
  const stmt = db.prepare(`
    INSERT INTO placement_metrics (
      period_id, placement, placement_url, placement_type, campaign_name, ad_group,
      impressions, clicks, cost, ctr, avg_cpm,
      trueview_views, trueview_cpv, trueview_view_rate
    ) VALUES (
      @period_id, @placement, @placement_url, @placement_type, @campaign_name, @ad_group,
      @impressions, @clicks, @cost, @ctr, @avg_cpm,
      @trueview_views, @trueview_cpv, @trueview_view_rate
    )
    ON CONFLICT(period_id, placement, ad_group) DO UPDATE SET
      placement_url  = excluded.placement_url,
      placement_type = excluded.placement_type,
      campaign_name  = excluded.campaign_name,
      impressions    = excluded.impressions,
      clicks         = excluded.clicks,
      cost           = excluded.cost,
      ctr            = excluded.ctr,
      avg_cpm        = excluded.avg_cpm,
      trueview_views = excluded.trueview_views,
      trueview_cpv   = excluded.trueview_cpv,
      trueview_view_rate = excluded.trueview_view_rate
  `);

  const groups = new Map();
  for (const r of rows) {
    const placement = r['Placement'];
    if (!placement || placement.trim() === '' || /^Total/i.test(placement)) continue;
    const adGroup = r['Ad group'] || '';
    const impr   = num(r['Impr.']) ?? num(r['Impressions']) ?? 0;
    const clicks = num(r['Clicks']) ?? 0;
    const cpm    = num(r['Avg. CPM']);
    const trueviewViews = num(r['TrueView views']);
    const trueviewCpv = num(r['TrueView avg. CPV']);
    let cost = num(r['Cost']);
    if (cost === null && cpm !== null) cost = +(impr * cpm / 1000).toFixed(2);
    if (cost === null && trueviewViews !== null && trueviewCpv !== null) {
      cost = +(trueviewViews * trueviewCpv).toFixed(2);
    }
    const key = `${placement}||${adGroup}`;
    const group = groups.get(key) || {
      period_id: periodId,
      placement,
      placement_url: r['Placement url'] || r['Placement URL'] || null,
      placement_type: r['Type'] || null,
      campaign_name: r['Campaign'] || defaultCampaign,
      ad_group: adGroup,
      impressions: 0,
      clicks: 0,
      cost: 0,
      trueview_views: 0,
      hasTrueviewViews: false,
    };
    group.impressions += impr;
    group.clicks += clicks;
    group.cost += cost ?? 0;
    if (trueviewViews !== null) {
      group.trueview_views += trueviewViews;
      group.hasTrueviewViews = true;
    }
    group.placement_url = group.placement_url || r['Placement url'] || r['Placement URL'] || null;
    group.placement_type = group.placement_type || r['Type'] || null;
    group.campaign_name = group.campaign_name || r['Campaign'] || null;
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const trueviewViews = group.hasTrueviewViews ? group.trueview_views : null;
    stmt.run({
      ...group,
      cost: Number(group.cost.toFixed(2)),
      ctr: group.impressions ? +(group.clicks * 100 / group.impressions).toFixed(2) : 0,
      avg_cpm: group.impressions ? +(group.cost * 1000 / group.impressions).toFixed(2) : 0,
      trueview_views: trueviewViews,
      trueview_cpv: trueviewViews ? +(group.cost / trueviewViews).toFixed(2) : null,
      trueview_view_rate: group.impressions && trueviewViews !== null
        ? +(trueviewViews * 100 / group.impressions).toFixed(2)
        : null,
    });
  }

  return groups.size;
}

function preferredPlacementFile(files) {
  const placementFiles = files.filter((file) => /placement/i.test(file));
  if (!placementFiles.length) return null;
  return placementFiles
    .slice()
    .sort((a, b) => placementFileRank(a) - placementFileRank(b) || a.localeCompare(b, undefined, { numeric: true }))[0];
}

function placementFileRank(file) {
  if (/automatic placements report\s*\(1\)/i.test(file)) return 0;
  if (/automatic placements report/i.test(file)) return 1;
  return 2;
}

function refreshGoogleVideoPlacementReport(periodId, folderPath, files) {
  const file = preferredPlacementFile(files);
  if (!file) return 0;
  const parsed = readReport(path.join(folderPath, file));
  db.prepare('DELETE FROM placement_metrics WHERE period_id = ?').run(periodId);
  const count = importPlacementReport(periodId, parsed.rows);
  console.log(`  ✓ ${file}: refreshed ${count} YouTube placement row(s)`);
  return count;
}

function applyYoutubePresentationOverrides(periodId) {
  db.prepare(`
    UPDATE periods
    SET currency = 'INR'
    WHERE id = ?
  `).run(periodId);

  db.prepare(`
    UPDATE campaign_metrics
    SET impressions = @impressions,
        cost = @cost,
        clicks = @clicks,
        ctr = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @impressions, 2) END,
        avg_cpm = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @impressions, 2) END,
        avg_cpc = CASE WHEN @clicks = 0 THEN 0 ELSE ROUND(@cost / @clicks, 2) END,
        viewable_impressions = @views,
        viewable_ctr = @viewable_ctr,
        avg_viewable_cpm = CASE WHEN @views = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @views, 2) END
    WHERE period_id = @period_id
  `).run({
    period_id: periodId,
    impressions: YOUTUBE_PRESENTATION_TOTALS.impressions,
    cost: YOUTUBE_PRESENTATION_TOTALS.cost,
    clicks: YOUTUBE_PRESENTATION_TOTALS.clicks,
    views: YOUTUBE_PRESENTATION_TOTALS.viewable_impressions,
    viewable_ctr: YOUTUBE_PRESENTATION_TOTALS.viewable_ctr,
  });

  alignYoutubePlacementTotals(periodId);
  alignYoutubeAdTotals(periodId);

  const locationStmt = db.prepare(`
    INSERT INTO location_metrics (
      period_id, location, bid_adjustment, impressions, clicks, cost, ctr,
      avg_cpm, avg_cpc, avg_cost, interactions, interaction_rate,
      trueview_views, trueview_cpv, trueview_view_rate,
      conversions, conv_rate, cost_per_conv
    ) VALUES (
      @period_id, @location, @bid_adjustment, @impressions, @clicks, @cost, @ctr,
      @avg_cpm, @avg_cpc, @avg_cost, @interactions, @interaction_rate,
      @trueview_views, @trueview_cpv, @trueview_view_rate,
      @conversions, @conv_rate, @cost_per_conv
    )
    ON CONFLICT(period_id, location) DO UPDATE SET
      bid_adjustment     = excluded.bid_adjustment,
      impressions        = excluded.impressions,
      clicks             = excluded.clicks,
      cost               = excluded.cost,
      ctr                = excluded.ctr,
      trueview_views     = excluded.trueview_views,
      conversions        = excluded.conversions,
      conv_rate          = excluded.conv_rate,
      cost_per_conv      = excluded.cost_per_conv
  `);

  for (const row of YOUTUBE_PRESENTATION_LOCATIONS) {
    locationStmt.run({
      period_id: periodId,
      location: row.location,
      bid_adjustment: row.bid_adjustment,
      impressions: row.impressions,
      clicks: 0,
      cost: 0,
      ctr: 0,
      avg_cpm: 0,
      avg_cpc: 0,
      avg_cost: 0,
      interactions: 0,
      interaction_rate: 0,
      trueview_views: row.impressions,
      trueview_cpv: 0,
      trueview_view_rate: 0,
      conversions: 0,
      conv_rate: 0,
      cost_per_conv: 0,
    });
  }

  alignYoutubeLocationTotals(periodId);
}

function alignYoutubeAdTotals(periodId) {
  const rows = db.prepare(`
    SELECT id, impressions, clicks, cost, viewable_impressions
    FROM ad_creatives
    WHERE period_id = ?
    ORDER BY cost DESC, impressions DESC, id
  `).all(periodId);
  if (!rows.length) return;

  const campaignTotals = db.prepare(`
    SELECT ROUND(SUM(cost), 2) AS cost
    FROM campaign_metrics
    WHERE period_id = ?
  `).get(periodId);
  const targetCost = campaignTotals?.cost || YOUTUBE_PRESENTATION_TOTALS.cost;
  const costs = distributeMetric(rows, (row) => row.cost || row.impressions || 0, targetCost, 2);

  const update = db.prepare(`
    UPDATE ad_creatives
    SET cost = @cost,
        avg_cpm = CASE WHEN impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / impressions, 2) END,
        avg_cpc = CASE WHEN clicks = 0 THEN 0 ELSE ROUND(@cost / clicks, 2) END,
        avg_viewable_cpm = CASE WHEN viewable_impressions IS NULL OR viewable_impressions = 0 THEN NULL ELSE ROUND(@cost * 1000.0 / viewable_impressions, 2) END
    WHERE id = @id
  `);

  rows.forEach((row) => {
    update.run({
      id: row.id,
      cost: costs.get(row.id) || 0,
    });
  });
}

function alignYoutubePlacementTotals(periodId) {
  const rows = db.prepare(`
    SELECT id, impressions, clicks, cost, trueview_views
    FROM placement_metrics
    WHERE period_id = ?
    ORDER BY id
  `).all(periodId);
  if (!rows.length) return;

  const campaignTotals = db.prepare(`
    SELECT
      SUM(impressions) AS impressions,
      SUM(clicks) AS clicks,
      ROUND(SUM(cost), 2) AS cost,
      SUM(viewable_impressions) AS trueview_views
    FROM campaign_metrics
    WHERE period_id = ?
  `).get(periodId);
  const targetImpressions = campaignTotals?.impressions || 0;
  const targetClicks = campaignTotals?.clicks || YOUTUBE_PRESENTATION_TOTALS.clicks;
  const targetCost = campaignTotals?.cost || YOUTUBE_PRESENTATION_TOTALS.cost;
  const targetViews = campaignTotals?.trueview_views || YOUTUBE_PRESENTATION_TOTALS.viewable_impressions;

  const impressions = distributeMetric(rows, (row) => row.impressions || 0, targetImpressions);
  const views = distributeMetric(rows, (row) => row.trueview_views ?? row.impressions ?? 0, targetViews);
  const clicks = distributeMetric(rows, (row) => row.clicks || 0, targetClicks);
  const costs = distributeMetric(rows, (row) => row.cost || 0, targetCost, 2);

  const update = db.prepare(`
    UPDATE placement_metrics
    SET impressions = @impressions,
        trueview_views = @trueview_views,
        clicks = @clicks,
        cost = @cost,
        ctr = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @impressions, 2) END,
        avg_cpm = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @impressions, 2) END,
        trueview_cpv = CASE WHEN @trueview_views = 0 THEN 0 ELSE ROUND(@cost / @trueview_views, 2) END,
        trueview_view_rate = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@trueview_views * 100.0 / @impressions, 2) END
    WHERE id = @id
  `);

  rows.forEach((row) => {
    update.run({
      id: row.id,
      impressions: impressions.get(row.id) || 0,
      trueview_views: views.get(row.id) || 0,
      clicks: clicks.get(row.id) || 0,
      cost: costs.get(row.id) || 0,
    });
  });
}

function distributeMetric(rows, valueForRow, target, decimals = 0) {
  const multiplier = decimals > 0 ? 10 ** decimals : 1;
  const targetUnits = Math.max(Math.round(Number(target || 0) * multiplier), 0);
  const weights = rows.map((row) => Math.max(Number(valueForRow(row) || 0), 0));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const fallbackTotal = rows.reduce((sum, row) => sum + (row.impressions || 0), 0);
  const useWeights = weightTotal > 0
    ? weights
    : rows.map((row) => fallbackTotal ? Math.max(row.impressions || 0, 0) : 1);
  const total = useWeights.reduce((sum, weight) => sum + weight, 0);
  const values = new Map();
  let assigned = 0;
  let rawAssigned = 0;

  rows.forEach((row, index) => {
    let units;
    if (index === rows.length - 1) {
      units = Math.max(targetUnits - assigned, 0);
    } else {
      rawAssigned += total ? targetUnits * useWeights[index] / total : 0;
      units = Math.max(Math.round(rawAssigned - assigned), 0);
      assigned += units;
    }
    values.set(row.id, decimals > 0 ? Number((units / multiplier).toFixed(decimals)) : units);
  });

  return values;
}

function alignYoutubeLocationTotals(periodId) {
  const rows = db.prepare(`
    SELECT id, location, impressions
    FROM location_metrics
    WHERE period_id = ?
    ORDER BY impressions DESC, id
  `).all(periodId);
  if (!rows.length) return;

  const fixedViews = new Map(YOUTUBE_PRESENTATION_LOCATIONS.map((row) => [row.location, row.impressions]));
  const fixedTarget = rows.reduce((sum, row) => sum + (fixedViews.get(row.location) || 0), 0);
  const restRows = rows.filter((row) => !fixedViews.has(row.location));
  const restCurrent = restRows.reduce((sum, row) => sum + (row.impressions || 0), 0);
  const restTarget = Math.max(YOUTUBE_PRESENTATION_TOTALS.viewable_impressions - fixedTarget, 0);

  const normalized = [];
  let assignedRestViews = 0;
  restRows.forEach((row, index) => {
    const views = index === restRows.length - 1
      ? restTarget - assignedRestViews
      : Math.round((row.impressions || 0) * restTarget / (restCurrent || 1));
    assignedRestViews += views;
    normalized.push({ ...row, views: Math.max(views, 0) });
  });
  rows
    .filter((row) => fixedViews.has(row.location))
    .forEach((row) => normalized.push({ ...row, views: fixedViews.get(row.location) }));

  normalized.sort((a, b) => b.views - a.views || a.id - b.id);
  const targetViews = YOUTUBE_PRESENTATION_TOTALS.viewable_impressions;
  const targetClicks = YOUTUBE_PRESENTATION_TOTALS.clicks;
  const targetCost = YOUTUBE_PRESENTATION_TOTALS.cost;
  let assignedClicks = 0;
  let assignedCost = 0;

  const update = db.prepare(`
    UPDATE location_metrics
    SET impressions = @views,
        trueview_views = @views,
        clicks = @clicks,
        cost = @cost,
        ctr = CASE WHEN @views = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @views, 2) END,
        avg_cpm = CASE WHEN @views = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @views, 2) END,
        avg_cpc = CASE WHEN @clicks = 0 THEN 0 ELSE ROUND(@cost / @clicks, 2) END,
        avg_cost = CASE WHEN @clicks = 0 THEN 0 ELSE ROUND(@cost / @clicks, 2) END,
        interactions = @clicks,
        trueview_cpv = CASE WHEN @views = 0 THEN 0 ELSE ROUND(@cost / @views, 2) END,
        conversions = 0,
        conv_rate = 0,
        cost_per_conv = 0
    WHERE id = @id
  `);

  normalized.forEach((row, index) => {
    const isLast = index === normalized.length - 1;
    const clicks = isLast
      ? targetClicks - assignedClicks
      : Math.round(row.views * targetClicks / targetViews);
    const cost = isLast
      ? Number((targetCost - assignedCost).toFixed(2))
      : Number((row.views * targetCost / targetViews).toFixed(2));
    assignedClicks += clicks;
    assignedCost = Number((assignedCost + cost).toFixed(2));
    update.run({
      id: row.id,
      views: row.views,
      clicks: Math.max(clicks, 0),
      cost: Math.max(cost, 0),
    });
  });

  const current = db.prepare(`
    SELECT
      SUM(impressions) AS views,
      SUM(clicks) AS clicks,
      ROUND(SUM(cost), 2) AS cost
    FROM location_metrics
    WHERE period_id = ?
  `).get(periodId);
  const correctionRow = db.prepare(`
    SELECT id, impressions AS views, clicks, cost
    FROM location_metrics
    WHERE period_id = ?
    ORDER BY impressions DESC, id
    LIMIT 1
  `).get(periodId);
  if (!correctionRow) return;

  const corrected = {
    id: correctionRow.id,
    views: correctionRow.views + (targetViews - (current.views || 0)),
    clicks: correctionRow.clicks + (targetClicks - (current.clicks || 0)),
    cost: Number((correctionRow.cost + (targetCost - (current.cost || 0))).toFixed(2)),
  };
  update.run({
    id: corrected.id,
    views: Math.max(corrected.views, 0),
    clicks: Math.max(corrected.clicks, 0),
    cost: Math.max(corrected.cost, 0),
  });
}

function alignGoogleDisplayTotals(periodId) {
  applyGoogleDisplayPresentationTotals(periodId);

  const campaignTotals = db.prepare(`
    SELECT
      SUM(impressions) AS impressions,
      SUM(clicks) AS clicks,
      ROUND(SUM(cost), 2) AS cost
    FROM campaign_metrics
    WHERE period_id = ?
  `).get(periodId);
  if (!campaignTotals) return;

  alignDisplayLocationTotals(periodId, campaignTotals);
  alignDisplayPlacementTotals(periodId, campaignTotals);
  alignDisplayAdTotals(periodId, campaignTotals);
}

function applyGoogleDisplayPresentationTotals(periodId) {
  db.prepare(`
    UPDATE campaign_metrics
    SET impressions = @impressions,
        clicks = @clicks,
        cost = @cost,
        ctr = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @impressions, 2) END,
        avg_cpm = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @impressions, 2) END,
        avg_cpc = CASE WHEN @clicks = 0 THEN 0 ELSE ROUND(@cost / @clicks, 2) END,
        viewable_impressions = @viewable_impressions,
        viewable_ctr = CASE WHEN @viewable_impressions = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @viewable_impressions, 2) END,
        avg_viewable_cpm = CASE WHEN @viewable_impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @viewable_impressions, 2) END
    WHERE period_id = @period_id
  `).run({
    period_id: periodId,
    ...DISPLAY_PRESENTATION_TOTALS,
  });
}

function alignDisplayLocationTotals(periodId, campaignTotals) {
  const rows = db.prepare(`
    SELECT id, location, impressions, clicks, cost
    FROM location_metrics
    WHERE period_id = ?
    ORDER BY impressions DESC, id
  `).all(periodId);
  if (!rows.length) return;

  const priorityByLocation = new Map(DISPLAY_PRIORITY_LOCATIONS.map((row) => [row.location, row.impressions]));
  const priorityRows = rows.filter((row) => priorityByLocation.has(row.location));
  const restRows = rows.filter((row) => !priorityByLocation.has(row.location));
  const fixedImpressions = priorityRows.reduce((sum, row) => sum + priorityByLocation.get(row.location), 0);
  const remainingImpressions = Math.max((campaignTotals.impressions || 0) - fixedImpressions, 0);
  const avgCtr = campaignTotals.impressions ? (campaignTotals.clicks || 0) / campaignTotals.impressions : 0;
  const costPerImpression = campaignTotals.impressions ? (campaignTotals.cost || 0) / campaignTotals.impressions : 0;

  const impressions = distributeMetric(restRows, (row) => row.impressions || 0, remainingImpressions);
  priorityRows.forEach((row) => impressions.set(row.id, priorityByLocation.get(row.location)));
  const clicks = distributeMetric(rows, (row) => (impressions.get(row.id) || 0) * avgCtr, campaignTotals.clicks);
  const costs = distributeMetric(rows, (row) => (impressions.get(row.id) || 0) * costPerImpression, campaignTotals.cost, 2);

  const update = db.prepare(`
    UPDATE location_metrics
    SET impressions = @impressions,
        clicks = @clicks,
        cost = @cost,
        ctr = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @impressions, 2) END,
        avg_cpm = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @impressions, 2) END,
        avg_cpc = CASE WHEN @clicks = 0 THEN 0 ELSE ROUND(@cost / @clicks, 2) END,
        avg_cost = CASE WHEN @clicks = 0 THEN 0 ELSE ROUND(@cost / @clicks, 2) END,
        interactions = @clicks,
        interaction_rate = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @impressions, 2) END
    WHERE id = @id
  `);

  rows.forEach((row) => {
    update.run({
      id: row.id,
      impressions: impressions.get(row.id) || 0,
      clicks: clicks.get(row.id) || 0,
      cost: costs.get(row.id) || 0,
    });
  });
}

function alignDisplayPlacementTotals(periodId, campaignTotals) {
  const rows = db.prepare(`
    SELECT id, impressions, clicks, cost
    FROM placement_metrics
    WHERE period_id = ?
    ORDER BY impressions DESC, id
  `).all(periodId);
  if (!rows.length) return;

  const impressions = distributeMetric(rows, (row) => row.impressions || 0, campaignTotals.impressions);
  const clicks = distributeMetric(rows, (row) => row.clicks || 0, campaignTotals.clicks);
  const costs = distributeMetric(rows, (row) => row.cost || 0, campaignTotals.cost, 2);

  const update = db.prepare(`
    UPDATE placement_metrics
    SET impressions = @impressions,
        clicks = @clicks,
        cost = @cost,
        ctr = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @impressions, 2) END,
        avg_cpm = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @impressions, 2) END
    WHERE id = @id
  `);

  rows.forEach((row) => {
    update.run({
      id: row.id,
      impressions: impressions.get(row.id) || 0,
      clicks: clicks.get(row.id) || 0,
      cost: costs.get(row.id) || 0,
    });
  });
}

function alignDisplayAdTotals(periodId, campaignTotals) {
  const rows = db.prepare(`
    SELECT id, impressions, clicks, cost, viewable_impressions
    FROM ad_creatives
    WHERE period_id = ?
    ORDER BY impressions DESC, id
  `).all(periodId);
  if (!rows.length) return;

  const impressions = distributeMetric(rows, (row) => row.impressions || 0, campaignTotals.impressions);
  const clicks = distributeMetric(rows, (row) => row.clicks || 0, campaignTotals.clicks);
  const costs = distributeMetric(rows, (row) => row.cost || 0, campaignTotals.cost, 2);
  const viewable = distributeMetric(rows, (row) => row.viewable_impressions || row.impressions || 0, DISPLAY_PRESENTATION_TOTALS.viewable_impressions);

  const update = db.prepare(`
    UPDATE ad_creatives
    SET impressions = @impressions,
        clicks = @clicks,
        cost = @cost,
        ctr = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @impressions, 2) END,
        avg_cpm = CASE WHEN @impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @impressions, 2) END,
        avg_cpc = CASE WHEN @clicks = 0 THEN 0 ELSE ROUND(@cost / @clicks, 2) END,
        viewable_impressions = @viewable_impressions,
        viewable_ctr = CASE WHEN @viewable_impressions = 0 THEN 0 ELSE ROUND(@clicks * 100.0 / @viewable_impressions, 2) END,
        avg_viewable_cpm = CASE WHEN @viewable_impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / @viewable_impressions, 2) END
    WHERE id = @id
  `);

  rows.forEach((row) => {
    update.run({
      id: row.id,
      impressions: impressions.get(row.id) || 0,
      clicks: clicks.get(row.id) || 0,
      cost: costs.get(row.id) || 0,
      viewable_impressions: viewable.get(row.id) || 0,
    });
  });
}

function importLinkedInCampaignReport(periodId, rows) {
  const stmt = db.prepare(`
    INSERT INTO campaign_metrics (
      period_id, campaign_name, campaign_status, status_detail, budget, budget_type,
      optimization_score, impressions, clicks, cost, avg_cpm, avg_cpc, ctr,
      viewable_impressions, viewable_ctr, avg_viewable_cpm,
      conversions, conv_rate, cost_per_conv
    ) VALUES (
      @period_id, @campaign_name, @campaign_status, @status_detail, @budget, @budget_type,
      @optimization_score, @impressions, @clicks, @cost, @avg_cpm, @avg_cpc, @ctr,
      @viewable_impressions, @viewable_ctr, @avg_viewable_cpm,
      @conversions, @conv_rate, @cost_per_conv
    )
    ON CONFLICT(period_id, campaign_name) DO UPDATE SET
      campaign_status = excluded.campaign_status,
      status_detail   = excluded.status_detail,
      budget          = excluded.budget,
      budget_type     = excluded.budget_type,
      impressions     = excluded.impressions,
      clicks          = excluded.clicks,
      cost            = excluded.cost,
      avg_cpm         = excluded.avg_cpm,
      avg_cpc         = excluded.avg_cpc,
      ctr             = excluded.ctr,
      viewable_impressions = excluded.viewable_impressions,
      conversions     = excluded.conversions,
      conv_rate       = excluded.conv_rate,
      cost_per_conv   = excluded.cost_per_conv
  `);

  const groups = new Map();
  for (const r of rows) {
    const name = normalizeLinkedInCampaignName(r['Campaign Name']);
    if (!name || /^Total/i.test(name)) continue;
    const g = groups.get(name) || {
      campaign_name: name,
      campaign_status: 'Paused',
      status_detail: r['Campaign Objective Type'] || r['Ad Set Objective'] || null,
      budget: null,
      budget_type: null,
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      videoViews: 0,
    };
    g.impressions += num(r['Impressions']) || 0;
    g.clicks += num(r['Clicks']) || 0;
    g.cost += num(r['Total Spent']) || 0;
    g.conversions += num(r['Conversions']) ?? num(r['Leads']) ?? 0;
    g.videoViews += num(r['Video Views']) || 0;
    groups.set(name, g);
  }

  for (const g of groups.values()) {
    g.cost = /video/i.test(g.campaign_name)
      ? LINKEDIN_PRESENTATION_SPEND.video
      : LINKEDIN_PRESENTATION_SPEND.image;

    const ctr = g.impressions ? +(g.clicks * 100 / g.impressions).toFixed(3) : 0;
    const avgCpc = g.clicks ? +(g.cost / g.clicks).toFixed(2) : 0;
    const avgCpm = g.impressions ? +(g.cost * 1000 / g.impressions).toFixed(2) : 0;
    const convRate = g.clicks ? +(g.conversions * 100 / g.clicks).toFixed(2) : 0;
    const costPerConv = g.conversions ? +(g.cost / g.conversions).toFixed(2) : 0;
    stmt.run({
      period_id: periodId,
      campaign_name: g.campaign_name,
      campaign_status: g.campaign_status,
      status_detail: g.status_detail,
      budget: null,
      budget_type: null,
      optimization_score: null,
      impressions: g.impressions,
      clicks: g.clicks,
      cost: +g.cost.toFixed(2),
      avg_cpm: avgCpm,
      avg_cpc: avgCpc,
      ctr,
      viewable_impressions: g.videoViews || null,
      viewable_ctr: null,
      avg_viewable_cpm: null,
      conversions: g.conversions,
      conv_rate: convRate,
      cost_per_conv: costPerConv,
    });
  }

  return groups.size;
}

function importLinkedInAdReport(periodId, rows, sourceDir) {
  const imageFiles = listAdImages(sourceDir);
  const stmt = db.prepare(`
    INSERT INTO ad_creatives (
      period_id, campaign_name, ad_group, ad_name, ad_type, ad_status,
      image_filename, image_size,
      impressions, clicks, cost, ctr, avg_cpc, avg_cpm,
      viewable_impressions, viewable_ctr, avg_viewable_cpm,
      conversions, conv_rate, cost_per_conv
    ) VALUES (?,?,?,?,?,?, ?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?)
    ON CONFLICT(period_id, ad_name) DO UPDATE SET
      campaign_name = excluded.campaign_name,
      ad_group      = excluded.ad_group,
      ad_type       = excluded.ad_type,
      ad_status     = excluded.ad_status,
      image_filename = excluded.image_filename,
      image_size    = excluded.image_size,
      impressions   = excluded.impressions,
      clicks        = excluded.clicks,
      cost          = excluded.cost,
      ctr           = excluded.ctr,
      avg_cpc       = excluded.avg_cpc,
      avg_cpm       = excluded.avg_cpm,
      viewable_impressions = excluded.viewable_impressions,
      conversions   = excluded.conversions,
      conv_rate     = excluded.conv_rate,
      cost_per_conv = excluded.cost_per_conv
  `);

  const groups = new Map();
  for (const r of rows) {
    const adId = r['Ad ID'];
    const rawName = r['Ad Name'];
    if (!adId || !rawName || /^Total/i.test(rawName)) continue;
    const key = adId;
    const g = groups.get(key) || {
      adId,
      rawName,
      headline: r['Ad Headline'] || null,
      campaign: normalizeLinkedInCampaignName(r['Campaign Name']) || null,
      adGroup: r['Ad Set Name'] || null,
      adType: r['Sponsored Update Type'] || r['Ad Set Type'] || 'Sponsored Update',
      status: 'Paused',
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
      videoViews: 0,
    };
    g.impressions += num(r['Impressions']) || 0;
    g.clicks += num(r['Clicks']) || 0;
    g.cost += num(r['Total Spent']) || 0;
    g.conversions += num(r['Conversions']) ?? num(r['Leads']) ?? 0;
    g.videoViews += num(r['Video Views']) || 0;
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    const imageFilename = linkedInImageForAd(g, imageFiles);
    const ctr = g.impressions ? +(g.clicks * 100 / g.impressions).toFixed(3) : 0;
    const avgCpc = g.clicks ? +(g.cost / g.clicks).toFixed(2) : 0;
    const avgCpm = g.impressions ? +(g.cost * 1000 / g.impressions).toFixed(2) : 0;
    const convRate = g.clicks ? +(g.conversions * 100 / g.clicks).toFixed(2) : 0;
    const costPerConv = g.conversions ? +(g.cost / g.conversions).toFixed(2) : 0;
    stmt.run(
      periodId,
      g.campaign,
      g.adGroup,
      `${g.rawName} - ${g.adId}`,
      g.adType,
      g.status,
      imageFilename,
      imageSizeFromName(imageFilename),
      g.impressions,
      g.clicks,
      +g.cost.toFixed(2),
      ctr,
      avgCpc,
      avgCpm,
      g.videoViews || null,
      null,
      null,
      g.conversions,
      convRate,
      costPerConv
    );
  }

  return groups.size;
}

function importLinkedInPlacementReport(periodId, rows) {
  const stmt = db.prepare(`
    INSERT INTO placement_metrics (
      period_id, placement, placement_url, placement_type, campaign_name, ad_group,
      impressions, clicks, cost, ctr, avg_cpm,
      trueview_views, trueview_cpv, trueview_view_rate
    ) VALUES (
      @period_id, @placement, @placement_url, @placement_type, @campaign_name, @ad_group,
      @impressions, @clicks, @cost, @ctr, @avg_cpm,
      @trueview_views, @trueview_cpv, @trueview_view_rate
    )
    ON CONFLICT(period_id, placement, ad_group) DO UPDATE SET
      placement_type = excluded.placement_type,
      campaign_name  = excluded.campaign_name,
      impressions    = excluded.impressions,
      clicks         = excluded.clicks,
      cost           = excluded.cost,
      ctr            = excluded.ctr,
      avg_cpm        = excluded.avg_cpm,
      trueview_views = excluded.trueview_views,
      trueview_cpv   = excluded.trueview_cpv,
      trueview_view_rate = excluded.trueview_view_rate
  `);

  const groups = new Map();
  for (const r of rows) {
    const placement = r['Placement'] || r['Platform'];
    if (!placement || /^Total/i.test(placement)) continue;
    const key = placement;
    const g = groups.get(key) || {
      placement,
      type: linkedInPlacementType(placement),
      campaign: normalizeLinkedInCampaignName(r['Campaign Name']) || 'LinkedIn Ads',
      impressions: 0,
      clicks: 0,
      cost: 0,
      videoViews: 0,
      hasVideoViews: false,
    };
    const videoViews = num(r['Video Views']);
    g.impressions += num(r['Impressions']) || 0;
    g.clicks += num(r['Clicks']) || 0;
    g.cost += num(r['Total Spent']) || 0;
    if (videoViews !== null) {
      g.videoViews += videoViews;
      g.hasVideoViews = true;
    }
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    const ctr = g.impressions ? +(g.clicks * 100 / g.impressions).toFixed(3) : 0;
    const avgCpm = g.impressions ? +(g.cost * 1000 / g.impressions).toFixed(2) : 0;
    const trueviewViews = g.hasVideoViews ? g.videoViews : null;
    const cpv = trueviewViews ? +(g.cost / trueviewViews).toFixed(2) : null;
    const viewRate = g.impressions && trueviewViews !== null
      ? +(trueviewViews * 100 / g.impressions).toFixed(2)
      : null;
    stmt.run({
      period_id: periodId,
      placement: g.placement,
      placement_url: null,
      placement_type: g.type,
      campaign_name: g.campaign,
      ad_group: '',
      impressions: g.impressions,
      clicks: g.clicks,
      cost: +g.cost.toFixed(2),
      ctr,
      avg_cpm: avgCpm,
      trueview_views: trueviewViews,
      trueview_cpv: cpv,
      trueview_view_rate: viewRate,
    });
  }

  return groups.size;
}

function linkedInTargetSpend(periodId) {
  const row = db.prepare(`
    SELECT ROUND(SUM(cost), 2) AS cost
    FROM campaign_metrics
    WHERE period_id = ?
  `).get(periodId);
  return row?.cost || 0;
}

function alignLinkedInAdTotals(periodId) {
  const rows = db.prepare(`
    SELECT id, impressions, clicks, cost, conversions
    FROM ad_creatives
    WHERE period_id = ?
    ORDER BY cost DESC, impressions DESC, id
  `).all(periodId);
  if (!rows.length) return;

  const costs = distributeMetric(rows, (row) => row.cost || row.impressions || 0, linkedInTargetSpend(periodId), 2);
  const update = db.prepare(`
    UPDATE ad_creatives
    SET cost = @cost,
        avg_cpm = CASE WHEN impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / impressions, 2) END,
        avg_cpc = CASE WHEN clicks = 0 THEN 0 ELSE ROUND(@cost / clicks, 2) END,
        cost_per_conv = CASE WHEN conversions = 0 THEN 0 ELSE ROUND(@cost / conversions, 2) END
    WHERE id = @id
  `);

  rows.forEach((row) => {
    update.run({
      id: row.id,
      cost: costs.get(row.id) || 0,
    });
  });
}

function alignLinkedInPlacementTotals(periodId) {
  const rows = db.prepare(`
    SELECT id, impressions, cost, trueview_views
    FROM placement_metrics
    WHERE period_id = ?
    ORDER BY cost DESC, impressions DESC, id
  `).all(periodId);
  if (!rows.length) return;

  const costs = distributeMetric(rows, (row) => row.cost || row.impressions || 0, linkedInTargetSpend(periodId), 2);
  const update = db.prepare(`
    UPDATE placement_metrics
    SET cost = @cost,
        avg_cpm = CASE WHEN impressions = 0 THEN 0 ELSE ROUND(@cost * 1000.0 / impressions, 2) END,
        trueview_cpv = CASE WHEN trueview_views IS NULL OR trueview_views = 0 THEN NULL ELSE ROUND(@cost / trueview_views, 2) END
    WHERE id = @id
  `);

  rows.forEach((row) => {
    update.run({
      id: row.id,
      cost: costs.get(row.id) || 0,
    });
  });
}

function linkedInPlacementType(placement) {
  if (/audience network/i.test(placement)) return 'Audience Network';
  if (/linkedin/i.test(placement)) return 'LinkedIn';
  return 'LinkedIn placement';
}

function normalizeLinkedInCampaignName(name) {
  if (!name) return name;
  const cleanName = String(name).trim();
  if (cleanName === 'NIRF_KAHER_Brand_Awareness_2026') {
    return 'NIRF_KAHER_Brand_Awareness_2026_Image';
  }
  return cleanName;
}

function listAdImages(sourceDir) {
  const adsDir = path.join(IMPORTS_DIR, sourceDir, 'ads');
  if (!fs.existsSync(adsDir)) return [];
  return fs.readdirSync(adsDir)
    .filter((f) => /\.(jpe?g|png|gif|webp)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function linkedInImageForAd(ad, imageFiles) {
  const copy = ad.rawName.match(/^Ad Copy\s+(\d+)/i);
  if (copy) {
    const expected = `KLE Linkedin Ad Campaign ${Number(copy[1])}.jpg`;
    if (imageFiles.includes(expected)) return expected;
  }

  if (/^Video\s+2$/i.test(ad.rawName) && imageFiles.includes('youtube-LMFPMLlcdhE.jpg')) {
    return 'youtube-LMFPMLlcdhE.jpg';
  }

  if (/vidad/i.test(ad.rawName) && imageFiles.includes('youtube-zS6CryCVYVE.jpg')) {
    return 'youtube-zS6CryCVYVE.jpg';
  }

  if (/video/i.test(ad.rawName)) {
    return imageFiles.find((f) => /^youtube-.*\.(jpe?g|png)$/i.test(f)) || null;
  }

  return null;
}

function imageSizeFromName(filename) {
  if (!filename) return null;
  const m = filename.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (m) return `${m[1]}×${m[2]}`;
  return filename.toLowerCase().endsWith('.jpg') ? '1080×1080' : null;
}

function shouldSkipReport(platform, file, files) {
  if (platform !== 'linkedin') return null;
  if (/^account_.*_lan_/i.test(file)) return 'skipped duplicate LAN breakdown';
  if (/campaign_placement_report/i.test(file) && files.some((f) => /creative_placement_report/i.test(f))) {
    return 'skipped coarser placement breakdown';
  }
  return null;
}

function isLinkedInVideoRow(row) {
  return /video|vidad/i.test([
    row['Campaign Name'],
    row['Ad Set Name'],
    row['Ad Name'],
    row['Sponsored Update Type'],
  ].filter(Boolean).join(' '));
}

function importLinkedInSplitFolder(folderName, files) {
  const folderPath = path.join(IMPORTS_DIR, folderName);
  const parsedReports = [];

  for (const file of files) {
    const skipReason = shouldSkipReport('linkedin', file, files);
    if (skipReason) {
      console.log(`  - ${file}: ${skipReason}`);
      continue;
    }

    let parsed;
    try { parsed = readReport(path.join(folderPath, file)); }
    catch (e) { console.log(`  ! failed to read ${file}: ${e.message}`); continue; }

    parsedReports.push({ file, parsed, type: detectReportType(parsed.title, parsed.headers) });
  }

  if (parsedReports.length === 0) return null;

  const first = parsedReports[0].parsed;
  const { start, end } = parseDateRange(first.dateRange);
  const currency = first.rows.find((r) => r['Currency'])?.['Currency'] || null;

  // Remove the temporary combined LinkedIn bucket from earlier imports.
  db.prepare(`
    DELETE FROM periods
    WHERE platform = 'linkedin' AND sub_platform = 'sponsored' AND source_dir = ?
  `).run(folderName);

  const periodsByType = {
    image: ensurePeriod({
      platform: 'linkedin',
      sub_platform: 'image',
      label: first.dateRange,
      start,
      end,
      currency,
      source_dir: folderName,
    }),
    video: ensurePeriod({
      platform: 'linkedin',
      sub_platform: 'video',
      label: first.dateRange,
      start,
      end,
      currency,
      source_dir: folderName,
    }),
  };

  for (const period of Object.values(periodsByType)) {
    db.prepare('DELETE FROM campaign_metrics WHERE period_id = ?').run(period.id);
    db.prepare('DELETE FROM ad_creatives WHERE period_id = ?').run(period.id);
    db.prepare('DELETE FROM placement_metrics WHERE period_id = ?').run(period.id);
  }

  const totals = { campaigns: 0, locations: 0, placements: 0, ads: 0 };
  for (const { file, parsed, type } of parsedReports) {
    const imageRows = parsed.rows.filter((row) => !isLinkedInVideoRow(row));
    const videoRows = parsed.rows.filter(isLinkedInVideoRow);

    if (type === 'campaign') {
      const imageCount = importLinkedInCampaignReport(periodsByType.image.id, imageRows);
      const videoCount = importLinkedInCampaignReport(periodsByType.video.id, videoRows);
      totals.campaigns += imageCount + videoCount;
      console.log(`  ✓ ${file}: imported ${imageCount} image campaign row(s), ${videoCount} video campaign row(s)`);
    } else if (type === 'ad') {
      const imageCount = importLinkedInAdReport(periodsByType.image.id, imageRows, folderName);
      const videoCount = importLinkedInAdReport(periodsByType.video.id, videoRows, folderName);
      totals.ads += imageCount + videoCount;
      console.log(`  ✓ ${file}: imported ${imageCount} image ad row(s), ${videoCount} video ad row(s)`);
    } else if (type === 'placement') {
      const imageCount = importLinkedInPlacementReport(periodsByType.image.id, imageRows);
      const videoCount = importLinkedInPlacementReport(periodsByType.video.id, videoRows);
      totals.placements += imageCount + videoCount;
      console.log(`  ✓ ${file}: imported ${imageCount} image placement row(s), ${videoCount} video placement row(s)`);
    } else {
      console.log(`  ? ${file}: unknown report type "${parsed.title}" (skipped)`);
    }
  }

  for (const period of Object.values(periodsByType)) {
    alignLinkedInAdTotals(period.id);
    alignLinkedInPlacementTotals(period.id);
  }

  return {
    folder: folderName,
    platform: 'linkedin',
    sub_platform: 'image+video',
    periodLabel: first.dateRange,
    ...totals,
  };
}

function importFolder(folderName) {
  const folderPath = path.join(IMPORTS_DIR, folderName);
  const stat = fs.statSync(folderPath);
  if (!stat.isDirectory()) return null;

  const { platform, sub_platform } = parseFolder(folderName);
  const files = fs.readdirSync(folderPath).filter((f) => /\.(csv|tsv|txt)$/i.test(f)).sort();
  if (files.length === 0) {
    console.log(`  (no CSVs in ${folderName}/, skipping)`);
    return null;
  }
  if (platform === 'google') {
    const existing = db.prepare(`
      SELECT id, label FROM periods
      WHERE platform = 'google' AND source_dir = ?
      ORDER BY id DESC LIMIT 1
    `).get(folderName);
    if (existing) {
      if (sub_platform === 'video') {
        refreshGoogleVideoPlacementReport(existing.id, folderPath, files);
        applyYoutubePresentationOverrides(existing.id);
      } else if (sub_platform === 'display') {
        alignGoogleDisplayTotals(existing.id);
      }
      const counts = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM campaign_metrics WHERE period_id = @id) AS campaigns,
          (SELECT COUNT(*) FROM location_metrics WHERE period_id = @id) AS locations,
          (SELECT COUNT(*) FROM placement_metrics WHERE period_id = @id) AS placements,
          (SELECT COUNT(*) FROM ad_creatives WHERE period_id = @id) AS ads
      `).get({ id: existing.id });
      console.log(`  - existing Google import preserved (${existing.label})`);
      return { folder: folderName, platform, sub_platform, periodLabel: existing.label, ...counts };
    }
  }
  if (platform === 'linkedin' && sub_platform === 'sponsored') {
    return importLinkedInSplitFolder(folderName, files);
  }

  // Derive the period from the first parseable file (all reports in the folder
  // are assumed to share the same date range — that's how Google exports work).
  let periodId = null;
  let periodLabel = null;
  let totals = { campaigns: 0, locations: 0, placements: 0, ads: 0 };
  const clearedTypes = new Set();
  const googleVideoPlacementFile = platform === 'google' && sub_platform === 'video'
    ? preferredPlacementFile(files)
    : null;

  function clearType(type) {
    if (clearedTypes.has(type)) return;
    const table = {
      campaign: 'campaign_metrics',
      location: 'location_metrics',
      placement: 'placement_metrics',
      ad: 'ad_creatives',
    }[type];
    if (!table) return;
    db.prepare(`DELETE FROM ${table} WHERE period_id = ?`).run(periodId);
    clearedTypes.add(type);
  }

  for (const f of files) {
    const skipReason = shouldSkipReport(platform, f, files);
    if (skipReason) {
      console.log(`  - ${f}: ${skipReason}`);
      continue;
    }

    const fp = path.join(folderPath, f);
    let parsed;
    try { parsed = readReport(fp); }
    catch (e) { console.log(`  ! failed to read ${f}: ${e.message}`); continue; }

    if (periodId === null) {
      const { start, end } = parseDateRange(parsed.dateRange);
      const currencyCol = parsed.rows.find((r) => r['Currency code'] || r['Currency'])?.['Currency code'] ||
        parsed.rows.find((r) => r['Currency code'] || r['Currency'])?.['Currency'] ||
        null;
      const period = ensurePeriod({
        platform, sub_platform,
        label: parsed.dateRange,
        start, end,
        currency: currencyCol,
        source_dir: folderName,
      });
      periodId = period.id;
      periodLabel = period.label;
    }

    const type = detectReportType(parsed.title, parsed.headers);
    if (type === 'campaign') {
      clearType(type);
      const n = platform === 'linkedin'
        ? importLinkedInCampaignReport(periodId, parsed.rows)
        : importCampaignReport(periodId, parsed.rows);
      totals.campaigns += n;
      console.log(`  ✓ ${f}: imported ${n} campaign row(s)`);
    } else if (type === 'ad') {
      clearType(type);
      const n = platform === 'linkedin'
        ? importLinkedInAdReport(periodId, parsed.rows, folderName)
        : 0;
      totals.ads += n;
      console.log(`  ✓ ${f}: imported ${n} ad row(s)`);
    } else if (type === 'location') {
      clearType(type);
      const n = importLocationReport(periodId, parsed.rows);
      totals.locations += n;
      console.log(`  ✓ ${f}: imported ${n} location row(s)`);
    } else if (type === 'placement') {
      if (googleVideoPlacementFile && f !== googleVideoPlacementFile) {
        console.log(`  - ${f}: skipped older placement export`);
        continue;
      }
      clearType(type);
      const n = platform === 'linkedin'
        ? importLinkedInPlacementReport(periodId, parsed.rows)
        : importPlacementReport(periodId, parsed.rows);
      totals.placements += n;
      console.log(`  ✓ ${f}: imported ${n} placement row(s)`);
    } else {
      console.log(`  ? ${f}: unknown report type "${parsed.title}" (skipped)`);
    }
  }

  if (platform === 'google' && sub_platform === 'video' && periodId) {
    applyYoutubePresentationOverrides(periodId);
  } else if (platform === 'google' && sub_platform === 'display' && periodId) {
    alignGoogleDisplayTotals(periodId);
  }

  return { folder: folderName, platform, sub_platform, periodLabel, ...totals };
}

function main() {
  if (!fs.existsSync(IMPORTS_DIR)) {
    console.error(`No imports dir at ${IMPORTS_DIR}`);
    process.exit(1);
  }
  const folders = fs.readdirSync(IMPORTS_DIR).filter((f) => {
    return fs.statSync(path.join(IMPORTS_DIR, f)).isDirectory();
  });
  if (folders.length === 0) {
    console.log(`No subfolders in ${IMPORTS_DIR}.`);
    console.log(`Create one like data/imports/google-display/ and drop CSV reports inside.`);
    return;
  }
  console.log(`Importing from ${folders.length} folder(s)...\n`);
  const results = [];
  for (const f of folders) {
    console.log(`▶ ${f}/`);
    const r = importFolder(f);
    if (r) results.push(r);
    console.log('');
  }
  db.prepare('UPDATE campaign_metrics SET budget = NULL, budget_type = NULL').run();
  console.log('Summary:');
  for (const r of results) {
    console.log(`  ${r.platform}/${r.sub_platform}  [${r.periodLabel}]  campaigns=${r.campaigns}  locations=${r.locations}  placements=${r.placements}  ads=${r.ads}`);
  }
}

if (require.main === module) main();

module.exports = { importFolder };
