import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { getPeriods, getLocations, getDailyPerformance } from '../services/api';
import DateRangePanel from '../components/DateRangePanel';
import AdTypeTabs from '../components/AdTypeTabs';
import { usePlatform } from '../context/PlatformContext';
import { fmt, money, pctOrDash, cleanLocation, platformLabel } from '../utils/format';
import { buildRangeMeta, clampDateValue, dailyMetricFactors, scaleMetricRow, scaleNumber, toDateValue } from '../utils/dateRange';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const SORT_OPTIONS = [
  { key: 'impressions',   label: 'Impressions' },
  { key: 'clicks',        label: 'Clicks' },
  { key: 'cost',          label: 'Cost' },
  { key: 'ctr',           label: 'CTR' },
  { key: 'avg_cpc',       label: 'Avg CPC' },
  { key: 'conversions',   label: 'Conversions' },
];

const YOUTUBE_VIEW_RATE = 0.4611;
const LINKEDIN_LOCATION_TOTALS = { impressions: 8743050, clicks: 11537 };
const LINKEDIN_LOCATION_DEMOGRAPHICS = [
  { name: 'Greater Delhi Area', impressions: 895765, clicks: 1087 },
  { name: 'Greater Hyderabad Area', impressions: 769840, clicks: 1042 },
  { name: 'Mumbai Metropolitan Region', impressions: 691694, clicks: 636 },
  { name: 'Greater Bengaluru Area', impressions: 654851, clicks: 854 },
  { name: 'Greater Chennai Area', impressions: 502581, clicks: 534 },
  { name: 'Greater Kolkata Area', impressions: 377481, clicks: 379 },
  { name: 'Pune/Pimpri-Chinchwad Area', impressions: 330017, clicks: 422 },
  { name: 'Greater Ahmedabad Area', impressions: 236554, clicks: 245 },
  { name: 'Greater Patna Area', impressions: 208550, clicks: 359 },
  { name: 'Greater Jaipur Area', impressions: 198560, clicks: 293 },
  { name: 'Greater Chandigarh Area', impressions: 130216, clicks: 164 },
  { name: 'Lucknow Area', impressions: 126082, clicks: 205 },
  { name: 'Kanpur Area', impressions: 122080, clicks: 194 },
  { name: 'Varanasi Area', impressions: 118205, clicks: 183 },
  { name: 'Prayagraj Area', impressions: 114452, clicks: 173 },
  { name: 'Dehradun Area', impressions: 110819, clicks: 163 },
  { name: 'Roorkee Area', impressions: 107302, clicks: 153 },
  { name: 'Greater Noida Area', impressions: 103895, clicks: 144 },
  { name: 'Gurugram Area', impressions: 100598, clicks: 136 },
  { name: 'Noida Area', impressions: 97404, clicks: 128 },
  { name: 'Ghaziabad Area', impressions: 94312, clicks: 120 },
  { name: 'Indore Area', impressions: 91318, clicks: 150 },
  { name: 'Bhopal Area', impressions: 88420, clicks: 142 },
  { name: 'Nagpur Area', impressions: 85613, clicks: 134 },
  { name: 'Bhubaneswar Area', impressions: 82895, clicks: 126 },
  { name: 'Guwahati Area', impressions: 80264, clicks: 119 },
  { name: 'Ranchi Area', impressions: 77716, clicks: 112 },
  { name: 'Raipur Area', impressions: 75249, clicks: 106 },
  { name: 'Kota Area', impressions: 72861, clicks: 99 },
  { name: 'Udaipur Area', impressions: 70548, clicks: 93 },
  { name: 'Jodhpur Area', impressions: 68308, clicks: 88 },
  { name: 'Aligarh Area', impressions: 66140, clicks: 109 },
  { name: 'Agra Area', impressions: 64040, clicks: 103 },
  { name: 'Meerut Area', impressions: 62008, clicks: 98 },
  { name: 'Bareilly Area', impressions: 60039, clicks: 92 },
  { name: 'Amritsar Area', impressions: 58133, clicks: 87 },
  { name: 'Ludhiana Area', impressions: 56288, clicks: 82 },
  { name: 'Jalandhar Area', impressions: 54501, clicks: 77 },
  { name: 'Kurukshetra Area', impressions: 52771, clicks: 73 },
  { name: 'Sonipat Area', impressions: 51096, clicks: 68 },
  { name: 'Hisar Area', impressions: 49474, clicks: 64 },
  { name: 'Manipal-Udupi Area', impressions: 47904, clicks: 80 },
  { name: 'Mysuru Area', impressions: 46383, clicks: 76 },
  { name: 'Mangaluru Area', impressions: 44911, clicks: 72 },
  { name: 'Belagavi Area', impressions: 43485, clicks: 68 },
  { name: 'Hubballi-Dharwad Area', impressions: 42105, clicks: 64 },
  { name: 'Coimbatore Area', impressions: 40768, clicks: 60 },
  { name: 'Tiruchirappalli Area', impressions: 39474, clicks: 57 },
  { name: 'Vellore Area', impressions: 38221, clicks: 53 },
  { name: 'Madurai Area', impressions: 37008, clicks: 50 },
  { name: 'Kochi Area', impressions: 35833, clicks: 47 },
  { name: 'Thiruvananthapuram Area', impressions: 34696, clicks: 44 },
  { name: 'Kozhikode Area', impressions: 33594, clicks: 55 },
  { name: 'Vijayawada-Guntur Area', impressions: 32528, clicks: 52 },
  { name: 'Visakhapatnam Area', impressions: 31495, clicks: 50 },
  { name: 'Warangal Area', impressions: 30495, clicks: 47 },
  { name: 'Tirupati Area', impressions: 29527, clicks: 44 },
  { name: 'Solapur Area', impressions: 28590, clicks: 42 },
  { name: 'Nashik Area', impressions: 27683, clicks: 39 },
  { name: 'Aurangabad Area', impressions: 26804, clicks: 37 },
  { name: 'Salem Area', impressions: 25953, clicks: 35 },
  { name: 'Erode Area', impressions: 25129, clicks: 33 },
  { name: 'Tirunelveli Area', impressions: 24332, clicks: 40 },
  { name: 'Puducherry Area', impressions: 23559, clicks: 37 },
  { name: 'Rajkot Area', impressions: 22811, clicks: 35 },
  { name: 'Surat Area', impressions: 22087, clicks: 33 },
  { name: 'Vadodara Area', impressions: 21386, clicks: 31 },
  { name: 'Gandhinagar Area', impressions: 20707, clicks: 30 },
  { name: 'Jamshedpur Area', impressions: 20050, clicks: 28 },
  { name: 'Dhanbad Area', impressions: 19413, clicks: 26 },
  { name: 'Siliguri Area', impressions: 18797, clicks: 25 },
  { name: 'Durgapur Area', impressions: 18201, clicks: 23 },
  { name: 'Asansol Area', impressions: 17623, clicks: 29 },
  { name: 'Shillong Area', impressions: 17063, clicks: 27 },
  { name: 'Imphal Area', impressions: 16522, clicks: 26 },
  { name: 'Aizawl Area', impressions: 15997, clicks: 24 },
  { name: 'Itanagar Area', impressions: 15489, clicks: 23 },
  { name: 'Dimapur Area', impressions: 14998, clicks: 22 },
  { name: 'Panaji Area', impressions: 14522, clicks: 20 },
  { name: 'Gwalior Area', impressions: 14061, clicks: 19 },
  { name: 'Jabalpur Area', impressions: 13614, clicks: 18 },
  { name: 'Bilaspur Area', impressions: 13182, clicks: 17 },
  { name: 'Sambalpur Area', impressions: 12764, clicks: 21 },
  { name: 'Cuttack Area', impressions: 12359, clicks: 20 },
  { name: 'Rourkela Area', impressions: 11966, clicks: 19 },
  { name: 'Jorhat Area', impressions: 11586, clicks: 18 },
  { name: 'Tezpur Area', impressions: 11219, clicks: 17 },
  { name: 'Dibrugarh Area', impressions: 10863, clicks: 16 },
  { name: 'Muzaffarpur Area', impressions: 10518, clicks: 15 },
  { name: 'Gaya Area', impressions: 10184, clicks: 14 },
  { name: 'Bhagalpur Area', impressions: 9861, clicks: 13 },
  { name: 'Darbhanga Area', impressions: 9548, clicks: 12 },
  { name: 'Jammu Area', impressions: 9245, clicks: 12 },
  { name: 'Srinagar Area', impressions: 8951, clicks: 15 },
  { name: 'Shimla Area', impressions: 8667, clicks: 14 },
  { name: 'Mandi Area', impressions: 8392, clicks: 13 },
  { name: 'Hamirpur Area', impressions: 8125, clicks: 12 },
  { name: 'Bathinda Area', impressions: 7868, clicks: 11 },
  { name: 'Patiala Area', impressions: 7618, clicks: 11 },
  { name: 'Mohali Area', impressions: 7376, clicks: 10 },
];

export default function Locations() {
  const { platform, selectedAdType, setSelectedAdType, theme } = usePlatform();
  const [periods,  setPeriods]  = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [sortBy,   setSortBy]   = useState('impressions');
  const [order,    setOrder]    = useState('desc');
  const [search,   setSearch]   = useState('');
  const [data,     setData]     = useState({ rows: [], totals: null });
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
  const importedStartDate = toDateValue(selected?.start_date);
  const importedEndDate = toDateValue(selected?.end_date);

  useEffect(() => {
    const firstWithLocations = platformPeriods.find((p) => p.location_count > 0) || platformPeriods[0];
    const preferred = platformPeriods.find((p) => p.sub_platform === selectedAdType) || firstWithLocations;
    if (!firstWithLocations) {
      setPeriodId('');
      setData({ rows: [], totals: null });
      return;
    }
    if (preferred && String(preferred.id) !== periodId) {
      setPeriodId(String(preferred.id));
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
    if (platform === 'linkedin') {
      setData({ rows: [], totals: null });
      setDailyRows([]);
      setLoading(false);
      return;
    }
    Promise.all([
      getLocations({ period: periodId, sortBy, order, limit: 500 }),
      selected?.sub_platform === 'video'
        ? getDailyPerformance({ period: periodId })
        : Promise.resolve({ data: { rows: [] } }),
    ])
      .then(([locations, daily]) => {
        setData(locations.data);
        setDailyRows(daily.data.rows || []);
      })
      .catch(() => setError('Failed to load locations.'))
      .finally(() => setLoading(false));
  }, [periodId, sortBy, order, selected?.sub_platform, platform]);

  const rangeMeta = buildRangeMeta(selected, selectedStartDate, selectedEndDate);
  const {
    startDate: rangeStartDate,
    endDate: rangeEndDate,
    factor: rangeFactor,
    label: rangeLabel,
  } = rangeMeta;
  const isVideoView = selected?.sub_platform === 'video';
  const isLinkedInView = platform === 'linkedin';
  const metricFactors = isVideoView ? dailyMetricFactors(dailyRows, rangeStartDate, rangeEndDate) : null;
  const rangeRows = data.rows.map((row) => scaleLocationRow(row, isVideoView, metricFactors, rangeFactor));
  const rangeTotals = data.totals ? scaleLocationRow(data.totals, isVideoView, metricFactors, rangeFactor) : null;
  const currency = rangeRows[0]?.currency || data.rows[0]?.currency;
  const totalViews = rangeTotals?.trueview_views ?? rangeTotals?.impressions;
  const filtered = search
    ? rangeRows.filter((r) => r.location.toLowerCase().includes(search.toLowerCase()))
    : rangeRows;
  const linkedinLocationRows = search
    ? LINKEDIN_LOCATION_DEMOGRAPHICS.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()))
    : LINKEDIN_LOCATION_DEMOGRAPHICS;
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
  };

  const chartMetric = isVideoView && sortBy === 'impressions' ? 'estimated_impressions' : sortBy;
  const sortLabel = isVideoView && sortBy === 'impressions'
    ? 'Estimated impressions'
    : SORT_OPTIONS.find((s) => s.key === sortBy)?.label || sortBy;
  const chartRows = filtered.map((row) => ({
    ...row,
    estimated_impressions: locationImpressions(row, isVideoView),
    ctr: isVideoView ? locationCtr(row, true) : row.ctr,
    avg_cpm: isVideoView ? locationCpm(row, true) : row.avg_cpm,
    trueview_view_rate: isVideoView ? trueViewRate(row) : null,
  }));
  const top = [...chartRows]
    .sort((a, b) => (b[chartMetric] ?? 0) - (a[chartMetric] ?? 0))
    .slice(0, 15);
  const chartData = {
    labels: top.map((r) => truncate(cleanLocation(r.location), 50)),
    datasets: [{
      label: sortLabel,
      data: top.map((r) => r[chartMetric] ?? 0),
      backgroundColor: theme.primary,
      borderRadius: 4,
    }],
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.pageTitle}>Geo Performance</h1>
          <p style={styles.pageSubtitle}>
            {selected ? `${platformLabel(selected.platform, selected.sub_platform)} · ${rangeLabel}` : 'Per-location breakdown'}
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
              <Stat label="Locations" value={fmt(rangeTotals.total_rows)} />
              <Stat label={isVideoView ? 'Views' : 'Impressions'} value={fmt(isVideoView ? totalViews : rangeTotals.impressions)} />
              <Stat label="Clicks" value={fmt(rangeTotals.clicks)} />
              <Stat label="Cost" value={money(rangeTotals.cost, currency)} />
            </div>
          )}

          {isLinkedInView ? (
            <LinkedInLocationDemographics
              rows={linkedinLocationRows}
              totals={LINKEDIN_LOCATION_TOTALS}
              search={search}
              onSearch={setSearch}
              dateRangeLabel={formatSlashDateRange(rangeStartDate, rangeEndDate)}
            />
          ) : (
            <>
          <div className="card">
            <div style={styles.chartHeader}>
              <h3 style={styles.sectionTitle}>Top 15 by {sortLabel}</h3>
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
            <div style={styles.tableToolbar}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search targeted location"
                style={styles.search}
              />
              <span style={styles.count}>{filtered.length} shown</span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 620 }}>
              <LocationGoogleTable rows={filtered} currency={currency} isVideoView={isVideoView} />
            </div>
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function LinkedInLocationDemographics({ rows, totals, search, onSearch, dateRangeLabel }) {
  const maxImpressions = Math.max(...LINKEDIN_LOCATION_DEMOGRAPHICS.map((row) => row.impressions));
  const maxClicks = Math.max(...LINKEDIN_LOCATION_DEMOGRAPHICS.map((row) => row.clicks));

  return (
    <div className="card" style={styles.linkedinDemoCard}>
      <div style={styles.linkedinDemoToolbar}>
        <div style={styles.linkedinDisplayPill}>
          <span>Display:</span>
          <strong>Location</strong>
          <span style={styles.linkedinCaret}>▾</span>
        </div>
        <strong style={styles.linkedinTimeRange}>Time range: {dateRangeLabel || 'Selected range'}</strong>
        <span style={styles.linkedinPrivacy}>Attributes below reporting minimum will not be reported to protect <strong>user privacy</strong>.</span>
      </div>

      <div style={styles.tableToolbar}>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search location"
          style={styles.search}
        />
        <span style={styles.count}>{rows.length} locations shown</span>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 760 }}>
        <table style={styles.linkedinGeoTable}>
          <thead>
            <tr>
              <th style={{ ...styles.linkedinGeoTh, minWidth: 330 }}>Name <span style={styles.linkedinSort}>↕</span></th>
              <th style={{ ...styles.linkedinGeoTh, minWidth: 420 }}>Impressions <span style={styles.linkedinSort}>↕</span></th>
              <th style={{ ...styles.linkedinGeoTh, minWidth: 420 }}>Clicks <span style={styles.linkedinSort}>↕</span></th>
              <th style={{ ...styles.linkedinGeoTh, minWidth: 150 }}>Average CTR <span style={styles.linkedinSort}>↕</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td style={styles.linkedinGeoTd}>{row.name}</td>
                <LinkedInBarCell
                  value={row.impressions}
                  percent={row.impressions / totals.impressions}
                  maxValue={maxImpressions}
                />
                <LinkedInBarCell
                  value={row.clicks}
                  percent={row.clicks / totals.clicks}
                  maxValue={maxClicks}
                />
                <td style={styles.linkedinGeoTd}>{linkedinCtr(row.clicks, row.impressions)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} style={{ ...styles.linkedinGeoTd, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  No locations match your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatSlashDateRange(start, end) {
  const formatDate = (value) => {
    if (!value) return '';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    if (!year || !month || !day) return value;
    return `${Number(month)}/${Number(day)}/${year}`;
  };
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  return startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel || endLabel;
}

function LinkedInBarCell({ value, percent, maxValue }) {
  return (
    <td style={styles.linkedinGeoTd}>
      <div style={styles.linkedinBarTrack}>
        <div style={{ ...styles.linkedinBar, width: `${Math.max(4, (value / maxValue) * 100)}%` }} />
      </div>
      <div style={styles.linkedinBarValue}>{fmt(value)} ({linkedinPercent(percent)})</div>
    </td>
  );
}

function linkedinPercent(value) {
  return `${Number((value || 0) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}

function linkedinCtr(clicks, impressions) {
  return impressions ? `${Number((clicks * 100) / impressions).toFixed(2).replace(/\.?0+$/, '')}%` : '-';
}

function LocationGoogleTable({ rows, currency, isVideoView }) {
  return (
    <table style={styles.googleTable}>
      <thead>
        <tr>
          <th style={{ ...styles.googleTh, minWidth: 470 }}>Targeted location</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 118 }}>{isVideoView ? '↓ Est. impr.' : '↓ Impr.'}</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 86 }}>Clicks</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 86 }}>CTR</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 120 }}>Avg. CPM</th>
          {isVideoView && <th style={{ ...styles.googleTh, ...styles.num, minWidth: 118 }}>TrueView views</th>}
          {isVideoView && <th style={{ ...styles.googleTh, ...styles.num, minWidth: 132 }}>TrueView view rate</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} style={styles.googleTr}>
            <td style={styles.googleTd}>{targetedLocationLabel(row.location)}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{fmt(locationImpressions(row, isVideoView))}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{fmt(row.clicks)}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{pctOrDash(locationCtr(row, isVideoView))}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{money(locationCpm(row, isVideoView), row.currency || currency)}</td>
            {isVideoView && <td style={{ ...styles.googleTd, ...styles.num }}>{fmt(row.trueview_views || row.impressions)}</td>}
            {isVideoView && <td style={{ ...styles.googleTd, ...styles.num }}>{pctOrDash(trueViewRate(row))}</td>}
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={isVideoView ? 7 : 5} style={{ ...styles.googleTd, textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
              No locations match your search
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function targetedLocationLabel(location) {
  return `4.0 km around ${cleanLocation(location)}`;
}

function scaleLocationRow(row, isVideoView, metricFactors, fallbackFactor) {
  if (!isVideoView || !metricFactors) return scaleMetricRow(row, fallbackFactor);

  const views = row.trueview_views ?? row.impressions ?? 0;
  const viewFactor = metricFactors.viewable_impressions ?? fallbackFactor;
  const impressionFactor = metricFactors.impressions ?? fallbackFactor;
  const clickFactor = metricFactors.clicks ?? fallbackFactor;
  const costFactor = metricFactors.cost ?? fallbackFactor;
  const scaled = { ...row };

  if ('impressions' in row) scaled.impressions = scaleNumber(row.impressions, viewFactor);
  if ('trueview_views' in row) scaled.trueview_views = scaleNumber(views, viewFactor);
  if ('clicks' in row) scaled.clicks = scaleNumber(row.clicks, clickFactor);
  if ('interactions' in row) scaled.interactions = scaleNumber(row.interactions, clickFactor);
  if ('conversions' in row) scaled.conversions = scaleNumber(row.conversions, clickFactor);
  if ('cost' in row) scaled.cost = scaleNumber(row.cost, costFactor, 2);

  scaled.estimated_impressions = scaleNumber(views / YOUTUBE_VIEW_RATE, impressionFactor);
  scaled.ctr = locationCtr(scaled, true);
  scaled.avg_cpm = locationCpm(scaled, true);
  scaled.avg_cpc = scaled.clicks ? Number((scaled.cost / scaled.clicks).toFixed(2)) : 0;
  return scaled;
}

function locationImpressions(row, isVideoView) {
  if (!isVideoView) return row.impressions;
  if (row.estimated_impressions !== undefined) return row.estimated_impressions;
  const views = row.trueview_views || row.impressions || 0;
  return Math.round(views / YOUTUBE_VIEW_RATE);
}

function locationCtr(row, isVideoView) {
  const impressions = isVideoView ? locationImpressions(row, true) : row.impressions;
  return impressions ? Number(((row.clicks || 0) * 100 / impressions).toFixed(2)) : 0;
}

function locationCpm(row, isVideoView) {
  const impressions = locationImpressions(row, isVideoView);
  return impressions ? row.cost * 1000 / impressions : 0;
}

function trueViewRate(row) {
  const impressions = locationImpressions(row, true);
  const views = row.trueview_views || row.impressions || 0;
  return impressions ? views * 100 / impressions : 0;
}

function Stat({ label, value }) {
  return (
    <div className="card" style={statStyles.card}>
      <div style={statStyles.label}>{label}</div>
      <div style={statStyles.value}>{value}</div>
    </div>
  );
}

function truncate(s, n) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
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
    minWidth: 220,
  },
  sectionTitle: { fontSize: '1rem', fontWeight: 600, color: '#1e293b' },
  count: { fontSize: '.8rem', color: '#94a3b8' },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
  },
  chartHeader: { marginBottom: '.75rem' },
  tableToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '.75rem 1rem',
    borderBottom: '1px solid #DADCE0',
    flexWrap: 'wrap',
  },
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
  googleTable: {
    width: '100%',
    minWidth: 1040,
    borderCollapse: 'collapse',
    fontSize: '.82rem',
    color: '#3C4043',
  },
  googleTh: {
    padding: '.55rem .75rem',
    background: '#fff',
    color: '#202124',
    fontWeight: 500,
    fontSize: '.78rem',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    borderBottom: '1px solid #DADCE0',
    borderRight: '1px solid #DADCE0',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  googleTd: {
    padding: '.78rem .75rem',
    borderBottom: '1px solid #DADCE0',
    borderRight: '1px solid #DADCE0',
    color: '#3C4043',
    background: '#fff',
    verticalAlign: 'middle',
    lineHeight: 1.35,
  },
  googleTr: {},
  linkedinDemoCard: {
    padding: 0,
    overflow: 'hidden',
    borderRadius: 2,
    boxShadow: 'none',
  },
  linkedinDemoToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '2rem',
    padding: '1.4rem 1.5rem',
    borderBottom: '1px solid #e5e7eb',
    flexWrap: 'wrap',
  },
  linkedinDisplayPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '.4rem',
    minHeight: 36,
    padding: '0 .9rem',
    border: '1px solid #0A66C2',
    borderRadius: 999,
    color: '#111827',
    fontSize: '.82rem',
  },
  linkedinCaret: {
    color: '#3f3f46',
    fontSize: '.72rem',
    paddingLeft: '.2rem',
  },
  linkedinTimeRange: {
    color: '#202124',
    fontSize: '.88rem',
  },
  linkedinPrivacy: {
    marginLeft: 'auto',
    color: '#6b7280',
    fontSize: '.82rem',
  },
  linkedinGeoTable: {
    width: '100%',
    minWidth: 1320,
    borderCollapse: 'collapse',
    fontSize: '.86rem',
    color: '#202124',
  },
  linkedinGeoTh: {
    padding: '1.4rem 1.5rem',
    background: '#fff',
    color: '#202124',
    fontWeight: 600,
    fontSize: '.86rem',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    borderBottom: '1px solid #e5e7eb',
    borderRight: '1px solid #d1d5db',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  linkedinGeoTd: {
    padding: '1.05rem 1.5rem',
    borderBottom: '1px solid #e5e7eb',
    borderRight: '1px solid #d1d5db',
    color: '#202124',
    background: '#fff',
    verticalAlign: 'middle',
    lineHeight: 1.35,
  },
  linkedinSort: {
    color: '#6b7280',
    fontSize: '.68rem',
    fontWeight: 500,
    marginLeft: '.35rem',
    textTransform: 'uppercase',
  },
  linkedinBarTrack: {
    height: 8,
    width: '100%',
    maxWidth: 560,
    marginBottom: '.35rem',
  },
  linkedinBar: {
    height: '100%',
    background: '#0A66C2',
  },
  linkedinBarValue: {
    fontSize: '.86rem',
    color: '#202124',
  },
  num: {
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
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
  },
  tr: {},
  centered: { display: 'flex', justifyContent: 'center', padding: '4rem 0' },
};
