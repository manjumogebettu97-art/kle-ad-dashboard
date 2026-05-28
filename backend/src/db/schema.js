const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_DIR
  ? path.resolve(process.env.DB_DIR)
  : path.join(__dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'dashboard.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    linkedin_account TEXT,
    google_account   TEXT,
    updated_at       TEXT   NOT NULL DEFAULT (datetime('now')),
    updated_by       INTEGER REFERENCES users(id)
  );

  -- One row per imported report bundle (a date range from a single platform/sub-platform).
  CREATE TABLE IF NOT EXISTS periods (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    platform      TEXT    NOT NULL,        -- 'google' | 'linkedin'
    sub_platform  TEXT    NOT NULL,        -- 'display' | 'search' | 'video' | 'sponsored' | ...
    label         TEXT    NOT NULL,        -- "February 1, 2026 - April 30, 2026"
    start_date    TEXT,                    -- 'YYYY-MM-DD' (nullable if unparseable)
    end_date      TEXT,
    currency      TEXT,
    source_dir    TEXT    NOT NULL,        -- folder under data/imports/
    imported_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(platform, sub_platform, label)
  );

  -- Per-campaign aggregate metrics for a given period.
  CREATE TABLE IF NOT EXISTS campaign_metrics (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id        INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    campaign_name    TEXT    NOT NULL,
    campaign_status  TEXT,
    status_detail    TEXT,
    budget           REAL,
    budget_type      TEXT,
    optimization_score REAL,
    impressions      INTEGER DEFAULT 0,
    clicks           INTEGER DEFAULT 0,
    cost             REAL    DEFAULT 0,
    avg_cpm          REAL,
    avg_cpc          REAL,
    ctr              REAL,
    viewable_impressions INTEGER,
    viewable_ctr     REAL,
    avg_viewable_cpm REAL,
    conversions      REAL    DEFAULT 0,
    conv_rate        REAL,
    cost_per_conv    REAL,
    UNIQUE(period_id, campaign_name)
  );

  -- Per-location aggregate metrics for a given period.
  CREATE TABLE IF NOT EXISTS location_metrics (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id        INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    location         TEXT    NOT NULL,
    bid_adjustment   TEXT,
    impressions      INTEGER DEFAULT 0,
    clicks           INTEGER DEFAULT 0,
    cost             REAL    DEFAULT 0,
    ctr              REAL,
    avg_cpm          REAL,
    avg_cpc          REAL,
    avg_cost         REAL,
    interactions     INTEGER DEFAULT 0,
    interaction_rate REAL,
    trueview_views   INTEGER,
    trueview_cpv     REAL,
    trueview_view_rate REAL,
    conversions      REAL    DEFAULT 0,
    conv_rate        REAL,
    cost_per_conv    REAL,
    UNIQUE(period_id, location)
  );

  -- Per-creative ad performance for a given period.
  CREATE TABLE IF NOT EXISTS ad_creatives (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id         INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    campaign_name     TEXT    NOT NULL,
    ad_group          TEXT,
    ad_name           TEXT    NOT NULL,
    ad_type           TEXT,
    ad_status         TEXT    DEFAULT 'Paused',
    image_filename    TEXT,
    image_size        TEXT,
    impressions       INTEGER DEFAULT 0,
    clicks            INTEGER DEFAULT 0,
    cost              REAL    DEFAULT 0,
    ctr               REAL,
    avg_cpc           REAL,
    avg_cpm           REAL,
    viewable_impressions INTEGER,
    viewable_ctr      REAL,
    avg_viewable_cpm  REAL,
    conversions       REAL    DEFAULT 0,
    conv_rate         REAL,
    cost_per_conv     REAL,
    UNIQUE(period_id, ad_name)
  );

  -- Per-placement metrics (where the ad was actually shown: mobile apps, sites, YouTube videos, …).
  CREATE TABLE IF NOT EXISTS placement_metrics (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id        INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
    placement        TEXT    NOT NULL,
    placement_url    TEXT,
    placement_type   TEXT,                  -- 'Mobile application' | 'Site' | 'YouTube video' | 'YouTube channel' | ...
    campaign_name    TEXT,
    ad_group         TEXT,
    impressions      INTEGER DEFAULT 0,
    clicks           INTEGER DEFAULT 0,
    cost             REAL    DEFAULT 0,
    ctr              REAL,
    avg_cpm          REAL,
    trueview_views   INTEGER,
    trueview_cpv     REAL,
    trueview_view_rate REAL,
    UNIQUE(period_id, placement, ad_group)
  );

  CREATE INDEX IF NOT EXISTS idx_campaign_metrics_period  ON campaign_metrics(period_id);
  CREATE INDEX IF NOT EXISTS idx_location_metrics_period  ON location_metrics(period_id);
  CREATE INDEX IF NOT EXISTS idx_location_metrics_cost    ON location_metrics(cost DESC);
  CREATE INDEX IF NOT EXISTS idx_ad_creatives_period      ON ad_creatives(period_id);
  CREATE INDEX IF NOT EXISTS idx_placement_metrics_period ON placement_metrics(period_id);
  CREATE INDEX IF NOT EXISTS idx_placement_metrics_impr   ON placement_metrics(impressions DESC);
`);

// Drop legacy refresh_interval column from settings if present (best-effort).
try {
  const cols = db.prepare(`PRAGMA table_info(settings)`).all().map((c) => c.name);
  if (cols.includes('refresh_interval')) {
    db.exec(`ALTER TABLE settings DROP COLUMN refresh_interval`);
  }
} catch (_) { /* older sqlite without DROP COLUMN — leave it */ }

try {
  const cols = db.prepare(`PRAGMA table_info(placement_metrics)`).all().map((c) => c.name);
  for (const [column, definition] of [
    ['trueview_views', 'INTEGER'],
    ['trueview_cpv', 'REAL'],
    ['trueview_view_rate', 'REAL'],
  ]) {
    if (!cols.includes(column)) {
      db.exec(`ALTER TABLE placement_metrics ADD COLUMN ${column} ${definition}`);
    }
  }
} catch (_) { /* keep booting if an older sqlite build refuses ALTER */ }

module.exports = db;
