import React, { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { getPeriods, getPlacements, getDailyPerformance } from '../services/api';
import DateRangePanel from '../components/DateRangePanel';
import AdTypeTabs from '../components/AdTypeTabs';
import { usePlatform } from '../context/PlatformContext';
import { fmt, money, pctOrDash, platformLabel } from '../utils/format';
import { REPORT_END_DATE, REPORT_START_DATE, buildRangeMeta, clampDateValue, dailyMetricFactors, scaleMetricRowWithFactors } from '../utils/dateRange';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const BASE_SORT_OPTIONS = [
  { key: 'impressions',    label: 'Impressions' },
  { key: 'cost',           label: 'Cost' },
  { key: 'ctr',            label: 'CTR' },
  { key: 'avg_cpm',        label: 'Avg CPM' },
  { key: 'placement',      label: 'Placement (A→Z)' },
];
const VIDEO_SORT_OPTIONS = [
  { key: 'trueview_views',     label: 'Video views' },
  { key: 'trueview_view_rate', label: 'View rate' },
  { key: 'trueview_cpv',       label: 'CPV' },
];
const VIDEO_SORT_KEYS = new Set(VIDEO_SORT_OPTIONS.map((option) => option.key));

export default function Placements() {
  const { platform, selectedAdType, setSelectedAdType, theme } = usePlatform();
  const [periods,  setPeriods]  = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy,   setSortBy]   = useState('impressions');
  const [order,    setOrder]    = useState('desc');
  const [search,   setSearch]   = useState('');
  const [data,     setData]     = useState({ rows: [], totals: null, byType: [] });
  const [dailyRows, setDailyRows] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    getPeriods()
      .then((r) => {
        setPeriods(r.data);
      })
      .catch(() => setError('Failed to load periods.'));
  }, []);

  const platformPeriods = periods.filter((p) => p.platform === platform);
  const selected = periods.find((p) => String(p.id) === periodId);
  const importedStartDate = selected ? REPORT_START_DATE : '';
  const importedEndDate = selected ? REPORT_END_DATE : '';

  useEffect(() => {
    const firstWithPlacements = platformPeriods.find((p) => p.placement_count > 0) || platformPeriods[0];
    const preferred = platformPeriods.find((p) => p.sub_platform === selectedAdType) || firstWithPlacements;
    if (!firstWithPlacements) {
      setPeriodId('');
      setData({ rows: [], totals: null, byType: [] });
      return;
    }
    if (preferred && String(preferred.id) !== periodId) {
      setPeriodId(String(preferred.id));
      setTypeFilter('');
    }
  }, [platform, periods, periodId, selectedAdType]);

  useEffect(() => {
    if (!selected) {
      setSelectedStartDate('');
      setSelectedEndDate('');
      return;
    }
    setSelectedStartDate(importedStartDate);
    setSelectedEndDate(importedEndDate);
  }, [selected?.id, importedStartDate, importedEndDate]);

  useEffect(() => {
    if (!periodId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const params = { period: periodId, sortBy, order, limit: 1000 };
    if (typeFilter) params.type = typeFilter;
    Promise.all([
      getPlacements(params),
      selected?.sub_platform === 'video'
        ? getDailyPerformance({ period: periodId })
        : Promise.resolve({ data: { rows: [] } }),
    ])
      .then(([placements, daily]) => {
        setData(placements.data);
        setDailyRows(daily.data.rows || []);
      })
      .catch(() => setError('Failed to load placements.'))
      .finally(() => setLoading(false));
  }, [periodId, sortBy, order, typeFilter, selected?.sub_platform]);

  const rangeMeta = buildRangeMeta(selected, selectedStartDate, selectedEndDate);
  const {
    startDate: rangeStartDate,
    endDate: rangeEndDate,
    factor: rangeFactor,
    label: rangeLabel,
  } = rangeMeta;
  const isVideoView = selected?.sub_platform === 'video';
  const sortOptions = isVideoView
    ? [BASE_SORT_OPTIONS[0], ...VIDEO_SORT_OPTIONS, ...BASE_SORT_OPTIONS.slice(1)]
    : BASE_SORT_OPTIONS;
  const metricFactors = isVideoView ? dailyMetricFactors(dailyRows, rangeStartDate, rangeEndDate) : null;
  const rangeRows = data.rows.map((row) => scaleMetricRowWithFactors(row, metricFactors, rangeFactor));
  const rangeTotals = data.totals ? scaleMetricRowWithFactors(data.totals, metricFactors, rangeFactor) : null;
  const rangeByType = (data.byType || []).map((row) => scaleMetricRowWithFactors(row, metricFactors, rangeFactor));
  const currency = rangeRows[0]?.currency || data.rows[0]?.currency;
  const videoViewRate = isVideoView && rangeTotals?.impressions
    ? (rangeTotals.trueview_views || 0) * 100 / rangeTotals.impressions
    : null;
  const avgCpv = isVideoView && rangeTotals?.trueview_views
    ? (rangeTotals.cost || 0) / rangeTotals.trueview_views
    : null;

  useEffect(() => {
    if (!isVideoView && VIDEO_SORT_KEYS.has(sortBy)) {
      setSortBy('impressions');
    }
  }, [isVideoView, sortBy]);

  const filtered = useMemo(() => {
    if (!search) return rangeRows;
    const q = search.toLowerCase();
    return rangeRows.filter((r) =>
      (r.placement || '').toLowerCase().includes(q) ||
      (r.placement_url || '').toLowerCase().includes(q) ||
      (r.campaign_name || '').toLowerCase().includes(q)
    );
  }, [rangeRows, search]);

  const handleStartDateChange = (value) => {
    const nextStart = clampDateValue(value, importedStartDate, importedEndDate);
    setSelectedStartDate(nextStart);
    if (!selectedEndDate || selectedEndDate < nextStart) {
      setSelectedEndDate(nextStart);
    }
  };
  const handleEndDateChange = (value) => {
    const nextEnd = clampDateValue(value, rangeStartDate || importedStartDate, importedEndDate);
    setSelectedEndDate(nextEnd);
  };
  const handlePeriodChange = (nextPeriodId) => {
    setPeriodId(nextPeriodId);
    const nextPeriod = periods.find((p) => String(p.id) === String(nextPeriodId));
    if (nextPeriod) setSelectedAdType(platform, nextPeriod.sub_platform);
    setTypeFilter('');
  };

  const top = filtered.slice(0, 15);
  const chartData = {
    labels: top.map((r) => truncate(displayName(r), 50)),
    datasets: [{
      label: sortOptions.find((s) => s.key === sortBy)?.label || sortBy,
      data: top.map((r) => r[sortBy] ?? 0),
      backgroundColor: theme.primary,
      borderRadius: 4,
    }],
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.pageTitle}>Targeted Content</h1>
          <p style={styles.pageSubtitle}>
            {selected
              ? `${platformLabel(selected.platform, selected.sub_platform)} · ${rangeLabel}`
              : 'Per-placement breakdown (apps, sites, YouTube)'}
          </p>
        </div>
        <div style={styles.headerControls}>
          <AdTypeTabs items={platformPeriods} activeKey={periodId} onChange={handlePeriodChange} />
          <DateRangePanel
            startDate={rangeStartDate}
            endDate={rangeEndDate}
            minDate={importedStartDate}
            maxDate={importedEndDate}
            disabled={!selected}
            onStartChange={handleStartDateChange}
            onEndChange={handleEndDateChange}
          />
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div style={styles.centered}><div className="spinner" /></div>
      ) : (
        <>
          {rangeTotals && (
            <div style={styles.statsRow}>
              <Stat label="Placements"  value={fmt(rangeTotals.total_rows)} />
              <Stat label="Impressions" value={fmt(rangeTotals.impressions)} />
              {isVideoView && <Stat label="Video views" value={fmt(rangeTotals.trueview_views)} />}
              {isVideoView && <Stat label="View rate" value={pctOrDash(videoViewRate)} />}
              {isVideoView && <Stat label="Avg. CPV" value={money(avgCpv, currency)} />}
              <Stat label="Cost"        value={money(rangeTotals.cost, currency)} />
            </div>
          )}

          {rangeByType.length > 0 && (
            <div className="card">
              <h3 style={styles.sectionTitle}>By placement type</h3>
              <div style={styles.chipRow}>
                <button
                  onClick={() => setTypeFilter('')}
                  style={chipStyle(typeFilter === '')}
                >
                  All <span style={styles.chipCount}>· {fmt(sumImpr(rangeByType))}</span>
                </button>
                {rangeByType.map((t) => (
                  <button
                    key={t.type || 'unknown'}
                    onClick={() => setTypeFilter(t.type || '')}
                    style={chipStyle(typeFilter === (t.type || ''))}
                  >
                    {t.type || 'Unknown'} <span style={styles.chipCount}>· {fmt(t.impressions)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div style={styles.chartHeader}>
              <h3 style={styles.sectionTitle}>
                Top 15 by {sortOptions.find((s) => s.key === sortBy)?.label}
              </h3>
            </div>
            <div style={{ height: 460 }}>
              <Bar
                data={chartData}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { color: '#f1f5f9' }, beginAtZero: true },
                    y: { grid: { display: false }, ticks: { font: { size: 11 } } },
                  },
                }}
              />
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={styles.tableHeader}>
              <div>
                <h3 style={styles.sectionTitle}>All placements</h3>
                <span style={styles.count}>{filtered.length} shown</span>
              </div>
              <div style={styles.tableControls}>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search placement, URL, campaign…"
                  style={styles.search}
                />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.select}>
                  {sortOptions.map((o) => (
                    <option key={o.key} value={o.key}>Sort: {o.label}</option>
                  ))}
                </select>
                <button
                  className="btn btn-outline"
                  onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
                  style={{ fontSize: '.8rem' }}
                >
                  {order === 'desc' ? '↓ Desc' : '↑ Asc'}
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 600 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Placement</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Campaign / Ad group</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Impr.</th>
                    {isVideoView && <th style={{ ...styles.th, textAlign: 'right' }}>Video views</th>}
                    {isVideoView && <th style={{ ...styles.th, textAlign: 'right' }}>View rate</th>}
                    {isVideoView && <th style={{ ...styles.th, textAlign: 'right' }}>CPV</th>}
                    <th style={{ ...styles.th, textAlign: 'right' }}>CTR</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Avg CPM</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} style={styles.tr}>
                      <td style={styles.td}>
                        {r.placement_url ? (
                          <a href={r.placement_url} target="_blank" rel="noreferrer" style={styles.link}>
                            {displayName(r)}
                          </a>
                        ) : (
                          displayName(r)
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={typeBadge(r.placement_type)}>{r.placement_type || '—'}</span>
                      </td>
                      <td style={styles.td}>
                        <div>{r.campaign_name || '—'}</div>
                        {r.ad_group && <div style={styles.subtle}>{r.ad_group}</div>}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(r.impressions)}</td>
                      {isVideoView && <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(r.trueview_views)}</td>}
                      {isVideoView && <td style={{ ...styles.td, textAlign: 'right' }}>{pctOrDash(r.trueview_view_rate)}</td>}
                      {isVideoView && <td style={{ ...styles.td, textAlign: 'right' }}>{money(r.trueview_cpv, r.currency)}</td>}
                      <td style={{ ...styles.td, textAlign: 'right' }}>{pctOrDash(r.ctr)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{money(r.avg_cpm, r.currency)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{money(r.cost, r.currency)}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={isVideoView ? 10 : 7} style={{ ...styles.td, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                        No placements match your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card" style={statStyles.card}>
      <div style={statStyles.label}>{label}</div>
      <div style={statStyles.value}>{value}</div>
    </div>
  );
}

function displayName(r) {
  // Google often prefixes mobile app placements as "Mobile App: <name> (Store), by <vendor>".
  // Strip the prefix to keep the table compact.
  const p = r.placement || '';
  return p.replace(/^Mobile App:\s*/i, '');
}

function truncate(s, n) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function sumImpr(byType) {
  return byType.reduce((sum, t) => sum + (t.impressions || 0), 0);
}

function chipStyle(active) {
  return {
    padding: '.35rem .75rem',
    borderRadius: 999,
    border: `1px solid ${active ? 'var(--brand-primary)' : '#e2e8f0'}`,
    background: active ? 'var(--brand-primary-light)' : '#fff',
    color: active ? 'var(--brand-primary)' : '#334155',
    fontSize: '.8rem',
    fontWeight: 500,
    cursor: 'pointer',
  };
}

const TYPE_COLORS = {
  'Mobile application': { bg: '#FEF3C7', fg: '#92400E' },
  'Site':               { bg: '#DBEAFE', fg: '#1E40AF' },
  'YouTube video':      { bg: '#FEE2E2', fg: '#991B1B' },
  'YouTube channel':    { bg: '#FCE7F3', fg: '#9D174D' },
};
function typeBadge(type) {
  const c = TYPE_COLORS[type] || { bg: '#F1F5F9', fg: '#475569' };
  return {
    display: 'inline-block',
    padding: '.15rem .55rem',
    borderRadius: 999,
    fontSize: '.7rem',
    fontWeight: 600,
    background: c.bg,
    color: c.fg,
    whiteSpace: 'nowrap',
  };
}

const statStyles = {
  card: { display: 'flex', flexDirection: 'column', gap: '.25rem' },
  label: { fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: '#64748b' },
  value: { fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' },
};

const styles = {
  page: { maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' },
  pageSubtitle: { fontSize: '.85rem', color: '#64748b', marginTop: '.25rem' },
  headerControls: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: '.7rem',
    flexWrap: 'wrap',
    flex: '1 1 640px',
  },
  filters: { display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' },
  select: {
    padding: '.45rem .8rem',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: '.875rem',
    background: '#fff',
    color: '#334155',
    cursor: 'pointer',
  },
  search: {
    padding: '.45rem .8rem',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    fontSize: '.875rem',
    minWidth: 240,
  },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#1e293b' },
  count: { fontSize: '.8rem', color: '#94a3b8' },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
  },
  chartHeader: { marginBottom: '.75rem' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.75rem' },
  chipCount: { color: '#94a3b8', fontWeight: 400 },
  tableHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid #f1f5f9',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  tableControls: { display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' },
  th: {
    padding: '.625rem 1rem',
    background: '#f8fafc',
    color: '#64748b',
    fontWeight: 600,
    fontSize: '.75rem',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    textAlign: 'left',
  },
  td: {
    padding: '.75rem 1rem',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    verticalAlign: 'top',
  },
  tr: {},
  link: { color: 'var(--brand-primary)', textDecoration: 'none' },
  subtle: { fontSize: '.75rem', color: '#94a3b8', marginTop: '.15rem' },
  centered: { display: 'flex', justifyContent: 'center', padding: '4rem 0' },
};
