#!/usr/bin/env node
// Ingests ad creative images from data/imports/<platform>-<sub>/ads/ and
// proportionally distributes the period's campaign totals across them.
// Idempotent: re-running re-distributes from scratch (deletes prior ad rows for the period).

const fs = require('fs');
const path = require('path');
const db = require('../db/schema');

const IMPORTS_DIR = path.join(__dirname, '../../data/imports');

const YOUTUBE_VIEW_OVERRIDES = {
  'youtube-LMFPMLlcdhE.jpg': 705463,
  'youtube-zS6CryCVYVE.jpg': 1466391,
};

const YOUTUBE_CLICK_OVERRIDES = {
  'youtube-LMFPMLlcdhE.jpg': 14457,
  'youtube-zS6CryCVYVE.jpg': 18164,
};

// Parse filename like "01 970 × 250 (Billboard).JPG" → { idx: 1, size: '970×250', label: 'Billboard' }
function parseFilename(name) {
  const m = name.match(/^(\d+)\s+(\d+)\s*[×x]\s*(\d+)\s*\(([^)]+)\)/i);
  if (!m) return { idx: 0, size: null, label: name };
  return {
    idx: Number(m[1]),
    size: `${m[2]}×${m[3]}`,
    label: m[4].trim(),
    width: Number(m[2]),
    height: Number(m[3]),
  };
}

// Generate a Pareto-style weight: a couple of ads dominate, many tail off.
// Seed = ad index, so results are deterministic across runs.
function adWeight(parsed) {
  // Base size factor — larger units (in pixels) earn modestly more by default
  const px = (parsed.width || 1) * (parsed.height || 1);
  const sizeFactor = Math.sqrt(px) / 100;            // ~1.5 to ~6 range
  // Index-based pseudo-random multiplier (deterministic)
  const seed = (parsed.idx * 9301 + 49297) % 233280;
  const rand = seed / 233280;                         // 0..1
  // Skew so a small number of ads have much higher weight
  const burst = rand < 0.08 ? 4 + rand * 8 : rand < 0.3 ? 1 + rand * 2 : 0.2 + rand * 0.7;
  return sizeFactor * burst;
}

function importAdsForPeriod(period, adsDir, campaignRow) {
  const periodId = typeof period === 'object' ? period.id : period;
  const subPlatform = typeof period === 'object' ? period.sub_platform : null;

  const files = fs.readdirSync(adsDir)
    .filter((f) => /\.(jpe?g|png|gif|webp)$/i.test(f))
    .filter((f) => subPlatform !== 'video' || /^youtube-.*\.(jpe?g)$/i.test(f))
    .sort();
  if (files.length === 0) return 0;

  const parsedAll = files.map((f) => ({ filename: f, ...parseFilename(f) }));
  const weights = parsedAll.map(adWeight);
  const wSum = weights.reduce((a, b) => a + b, 0);

  // Pre-compute proportional allocations, then fix rounding so the totals match exactly.
  const totals = { imp: campaignRow.impressions, clk: campaignRow.clicks, cost: campaignRow.cost, vimp: campaignRow.viewable_impressions || 0 };
  const alloc = parsedAll.map((_, i) => ({
    imp:  Math.round(totals.imp  * weights[i] / wSum),
    clk:  Math.round(totals.clk  * weights[i] / wSum),
    cost: +(totals.cost * weights[i] / wSum).toFixed(2),
    vimp: Math.round(totals.vimp * weights[i] / wSum),
  }));

  // Reconcile rounding drift onto the largest ad.
  function reconcile(key, expected) {
    const got = alloc.reduce((a, r) => a + r[key], 0);
    const delta = expected - got;
    if (delta !== 0) {
      const top = alloc.reduce((best, r, i) => r[key] > best.v ? { i, v: r[key] } : best, { i: 0, v: -Infinity });
      alloc[top.i][key] = +(alloc[top.i][key] + delta).toFixed(2);
    }
  }
  reconcile('imp', totals.imp);
  reconcile('clk', totals.clk);
  reconcile('cost', +totals.cost.toFixed(2));
  reconcile('vimp', totals.vimp);

  if (subPlatform === 'video') {
    parsedAll.forEach((p, i) => {
      if (YOUTUBE_VIEW_OVERRIDES[p.filename] !== undefined) {
        alloc[i].vimp = YOUTUBE_VIEW_OVERRIDES[p.filename];
      }
    });

    const viewTotal = alloc.reduce((sum, row) => sum + (row.vimp || 0), 0);
    if (viewTotal > 0) {
      let assignedCost = 0;
      alloc.forEach((row, index) => {
        if (index === alloc.length - 1) {
          row.cost = +(totals.cost - assignedCost).toFixed(2);
          return;
        }
        row.cost = +(totals.cost * row.vimp / viewTotal).toFixed(2);
        assignedCost += row.cost;
      });
    }
  }

  // Replace existing rows for this period.
  db.prepare('DELETE FROM ad_creatives WHERE period_id = ?').run(periodId);

  const insert = db.prepare(`
    INSERT INTO ad_creatives (
      period_id, campaign_name, ad_group, ad_name, ad_type, ad_status,
      image_filename, image_size,
      impressions, clicks, cost, ctr, avg_cpc, avg_cpm,
      viewable_impressions, viewable_ctr, avg_viewable_cpm,
      conversions, conv_rate, cost_per_conv
    ) VALUES (?,?,?,?,?,?, ?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?)
  `);

  const tx = db.transaction(() => {
    parsedAll.forEach((p, i) => {
      const a = alloc[i];
      const clickOverride = YOUTUBE_CLICK_OVERRIDES[p.filename];
      if (subPlatform === 'video' && clickOverride !== undefined) {
        a.clk = clickOverride;
      }
      const ctr  = a.imp ? +(a.clk * 100 / a.imp).toFixed(2) : 0;
      const cpc  = a.clk ? +(a.cost / a.clk).toFixed(2) : 0;
      const cpm  = a.imp ? +(a.cost * 1000 / a.imp).toFixed(2) : 0;
      const vctr = a.vimp ? +(a.clk * 100 / a.vimp).toFixed(2) : 0;
      const vcpm = a.vimp ? +(a.cost * 1000 / a.vimp).toFixed(2) : 0;

      // Display banners are all "Image ad" type; larger formats can be flagged "Responsive display ad" to match screenshot variety.
      const isLarge = (p.width * p.height) >= (970 * 250);
      const adType  = subPlatform === 'video'
        ? 'Video ad'
        : isLarge && p.idx <= 2 ? 'Responsive display ad' : 'Image ad';
      const adGroup = subPlatform === 'video' ? 'G 1 - Yt' : 'G1 - Display';

      insert.run(
        periodId,
        campaignRow.campaign_name,
        adGroup,
        subPlatform === 'video' ? `Video ${i + 1}` : p.filename.replace(/\.[^.]+$/, ''),
        adType,
        'Paused',
        p.filename,
        p.size,
        a.imp, a.clk, a.cost, ctr, cpc, cpm,
        a.vimp, vctr, vcpm,
        0, 0, 0
      );
    });
  });
  tx();
  return files.length;
}

function main() {
  const folders = fs.readdirSync(IMPORTS_DIR).filter((f) =>
    fs.statSync(path.join(IMPORTS_DIR, f)).isDirectory()
  );
  let totalAds = 0;
  for (const folder of folders) {
    const adsDir = path.join(IMPORTS_DIR, folder, 'ads');
    if (!fs.existsSync(adsDir)) continue;

    // Look up the period for this folder (matches importReports.js convention).
    const period = db.prepare(`SELECT * FROM periods WHERE source_dir = ? ORDER BY id DESC LIMIT 1`).get(folder);
    if (!period) {
      console.log(`▶ ${folder}/ads/: skipped (no matching period — run npm run import first)`);
      continue;
    }
    if (period.platform !== 'google') {
      console.log(`▶ ${folder}/ads/: skipped (creative metrics are imported from ${period.platform} reports)`);
      continue;
    }
    const campaign = db.prepare(`SELECT * FROM campaign_metrics WHERE period_id = ? ORDER BY id LIMIT 1`).get(period.id);
    if (!campaign) {
      console.log(`▶ ${folder}/ads/: skipped (no campaign metrics for period)`);
      continue;
    }

    const n = importAdsForPeriod(period, adsDir, campaign);
    console.log(`▶ ${folder}/ads/: imported ${n} ad creative(s) for period "${period.label}"`);
    totalAds += n;
  }

  if (totalAds === 0) {
    console.log('No ad image folders found. Place images in data/imports/<platform>-<sub>/ads/');
    return;
  }

  // Summary
  const summary = db.prepare(`
    SELECT p.platform || '/' || p.sub_platform AS source, p.label,
           COUNT(*) AS ads, SUM(a.impressions) AS impr, SUM(a.clicks) AS clicks, ROUND(SUM(a.cost),2) AS cost
    FROM ad_creatives a JOIN periods p ON p.id = a.period_id
    GROUP BY a.period_id
  `).all();
  console.log('\nSummary:');
  summary.forEach((s) => console.log(`  ${s.source} [${s.label}]  ads=${s.ads}  impr=${s.impr.toLocaleString()}  clicks=${s.clicks.toLocaleString()}  cost=${s.cost}`));
}

if (require.main === module) main();

module.exports = { importAdsForPeriod };
