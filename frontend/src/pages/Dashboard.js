import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js';
import { getPeriods, getSummary, getCampaigns, getHighlights, getLocations, getPlacements, getAds, getDailyPerformance } from '../services/api';
import KpiCard       from '../components/KpiCard';
import CampaignTable from '../components/CampaignTable';
import DateRangePanel from '../components/DateRangePanel';
import AdTypeTabs from '../components/AdTypeTabs';
import TooltipValue from '../components/TooltipValue';
import { usePlatform } from '../context/PlatformContext';
import { fmt, money, pct, compact, compactMoney, platformLabel, cleanLocation } from '../utils/format';
import {
  buildRangeMeta,
  clampDateValue,
  dailyMetricFactors,
  daysInclusive,
  scaleMetricRow,
  scaleMetricRowWithFactors,
  scaleNumber,
  toDateValue,
} from '../utils/dateRange';

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Tooltip, Legend);

function viewKey(period) {
  return `${period.platform}:${period.sub_platform}`;
}

const YOUTUBE_VIEW_RATE = 0.4611;
const LINKEDIN_PRESENTATION_REACH = 2730000;
const LINKEDIN_VIDEO_REACH = 679380;
const LINKEDIN_TOP_AD_SET_REACH = 2063200;
const LINKEDIN_TOP_AD_REACH = 1542231;
const LINKEDIN_DWELL_TIME = 21.53;
const LINKEDIN_AD_SET_REACH = {
  'Set 3 - SS': 1213014,
  'Set 2 - RR': 1088667,
  'Set 1 - KK': 2063303,
};
const LINKEDIN_AD_SET_IDS = {
  'Set 3 - SS': '557729336',
  'Set 2 - RR': '558502386',
  'Set 1 - KK': '558600776',
};
const LINKEDIN_AUDIENCE_OVERVIEW = [
  ['Ready', 'Status'],
  ['750', 'Last audience count'],
  ['65%', 'Match rate'],
  ['Contact list', 'Source'],
  ['Owned', 'Ownership'],
];
const LINKEDIN_CUSTOM_AUDIENCE_AD_SETS = [
  {
    name: 'Set 3 - SS',
    id: '557729336',
    adType: 'image',
    reach: 1213014,
    campaign: 'NIRF_KAHER_Brand_Awareness_2026_Image',
    cost: 149047.59,
  },
  {
    name: 'Set 1 - KK',
    id: '558600776',
    adType: 'image',
    reach: 2063303,
    campaign: 'NIRF_KAHER_Brand_Awareness_2026_Image',
    cost: 149143.54,
  },
  {
    name: 'Set 2 - RR',
    id: '558502386',
    adType: 'image',
    reach: 1088667,
    campaign: 'NIRF_KAHER_Brand_Awareness_2026_Image',
    cost: 149162.01,
  },
  {
    name: 'Video ads',
    id: '558607796',
    adType: 'video',
    reach: 679381,
    campaign: 'NIRF_AcademicLeaders_India_Mar2026 - Video',
    cost: 450886.79,
  },
];
const LINKEDIN_AUDIENCE_AD_SETS = {
  'Set 3 - SS': {
    reach: 1213014,
    cost: 149047.59,
    costPerResult: 122.87,
  },
  'Set 1 - KK': {
    reach: 2063303,
    cost: 149143.54,
    costPerResult: 72.28,
  },
  'Set 2 - RR': {
    reach: 1088667,
    cost: 149162.01,
    costPerResult: 137.01,
  },
};

const LINKEDIN_AD_TITLE_BY_IMAGE = {
  'KLE Linkedin Ad Campaign 1.jpg': 'Empowering Communities. Protecting the Planet.',
  'KLE Linkedin Ad Campaign 2.jpg': 'Care Beyond Classrooms: Making a Real-World Impact',
  'KLE Linkedin Ad Campaign 3.jpg': "KLE's 100+ Years of Legacy Powers KAHER",
  'KLE Linkedin Ad Campaign 4.jpg': 'Healing Communities: Hands-On Experience with a Social Purpose',
  'KLE Linkedin Ad Campaign 5.jpg': 'Learning That Serves Communities',
  'KLE Linkedin Ad Campaign 6.jpg': 'Research That Moves Health Forward',
  'KLE Linkedin Ad Campaign 7.jpg': 'Advanced Technology. Human Connection.',
};

const LINKEDIN_AUDIENCE_GROUPS = {
  seniorities: {
    label: 'Academic roles',
    rows: [
      ['Vice Chancellor / Pro VC', 18, 610000],
      ['Director / Dean', 16, 542000],
      ['Registrar / Controller', 13, 438000],
      ['Professor / Faculty', 12, 405000],
      ['Principal / HOD', 9, 306000],
    ],
  },
  locations: {
    label: 'Locations',
    rows: [
      ['Greater Delhi Area', 11, 694000],
      ['Mumbai Metropolitan Region', 9, 513000],
      ['Greater Hyderabad Area', 9, 610000],
      ['Greater Bengaluru Area', 8, 499000],
      ['Greater Chennai Area', 6, 373000],
    ],
  },
  functions: {
    label: 'Academic functions',
    rows: [
      ['Higher Education', 17, 574000],
      ['Research & Development', 12, 405000],
      ['Academic Administration', 10, 338000],
      ['Medical Education', 8, 270000],
      ['Institutional Strategy', 6, 203000],
    ],
  },
};
const LINKEDIN_VIDEO_AUDIENCE_GROUPS = {
  seniorities: {
    label: 'Academic roles',
    rows: [
      ['Vice Chancellor / Pro VC', 15, 102000],
      ['Director / Dean', 14, 95000],
      ['Registrar / Controller', 11, 75000],
      ['Professor / Faculty', 10, 68000],
      ['Principal / HOD', 7, 48000],
    ],
  },
  locations: {
    label: 'Locations',
    rows: [
      ['Greater Delhi Area', 10, 68000],
      ['Mumbai Metropolitan Region', 8, 54000],
      ['Greater Hyderabad Area', 8, 54000],
      ['Greater Bengaluru Area', 7, 48000],
      ['Greater Chennai Area', 5, 34000],
    ],
  },
  functions: {
    label: 'Academic functions',
    rows: [
      ['Higher Education', 14, 95000],
      ['Research & Development', 12, 82000],
      ['Academic Administration', 9, 61000],
      ['Medical Education', 8, 54000],
      ['Institutional Strategy', 5, 34000],
    ],
  },
};

export default function Dashboard() {
  const { platform, selectedAdType, setSelectedAdType, theme } = usePlatform();
  const [periods,   setPeriods]   = useState([]);
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [summary,    setSummary]    = useState(null);
  const [campaigns,  setCampaigns]  = useState([]);
  const [highlights, setHighlights] = useState(null);
  const [linkedInSummary, setLinkedInSummary] = useState(null);
  const [topLocations, setTopLocations] = useState([]);
  const [topPlacements, setTopPlacements] = useState([]);
  const [topAds, setTopAds] = useState([]);
  const [dailyRows, setDailyRows] = useState([]);
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // Load period list once.
  useEffect(() => {
    getPeriods()
      .then((r) => setPeriods(r.data))
      .catch(() => setError('Failed to load periods. Is the backend running?'));
  }, []);

  // Available platform/ad-type views, e.g. Google Display Ads, LinkedIn Video Ads.
  const viewPeriods = periods.filter((period) => period.platform === platform);
  const availableViews = periods
    .filter((period) => period.platform === platform)
    .reduce((views, period) => {
    const key = viewKey(period);
    if (!views.some((view) => view.key === key)) {
      views.push({
        key,
        platform: period.platform,
        sub_platform: period.sub_platform,
        label: platformLabel(period.platform, period.sub_platform),
      });
    }
    return views;
  }, []);
  const activeViewKey = selectedAdType ? `${platform}:${selectedAdType}` : '';
  const activeView = availableViews.find((view) => view.key === activeViewKey);
  const activePeriod = viewPeriods.find((period) => activeView && viewKey(period) === activeView.key);
  const importedStartDate = toDateValue(activePeriod?.start_date);
  const importedEndDate = toDateValue(activePeriod?.end_date);

  // Default-select the first available platform/ad-type when periods first load.
  useEffect(() => {
    const firstPeriod = periods.find((period) => period.platform === platform);
    if (!firstPeriod) return;
    if (!periods.some((period) => period.platform === platform && period.sub_platform === selectedAdType)) {
      setSelectedAdType(platform, firstPeriod.sub_platform);
    }
  }, [periods, platform, selectedAdType, setSelectedAdType]);

  // Reset the date range to the imported campaign period when the ad view changes.
  useEffect(() => {
    if (!activePeriod) {
      setSelectedStartDate('');
      setSelectedEndDate('');
      return;
    }
    setSelectedStartDate(importedStartDate);
    setSelectedEndDate(importedEndDate);
  }, [activePeriod?.id, importedStartDate, importedEndDate]);

  // Reload everything when the platform/ad-type view changes.
  useEffect(() => {
    if (!activeView) { setLoading(false); setDailyRows([]); return; }
    setLoading(true);
    setError('');
    const params = { platform: activeView.platform, sub_platform: activeView.sub_platform };
    const linkedInSummaryRequest = activeView.platform === 'linkedin'
      ? getSummary({ platform: 'linkedin' })
      : Promise.resolve({ data: null });
    const dailyRequest = activePeriod?.id
      ? getDailyPerformance({ period: activePeriod.id })
      : Promise.resolve({ data: { rows: [] } });
    Promise.all([
      getSummary(params),
      getCampaigns(params),
      getHighlights(params),
      getLocations({ ...params, sortBy: 'impressions', order: 'desc', limit: 4 }),
      getPlacements({ ...params, sortBy: 'impressions', order: 'desc', limit: 5 }),
      getAds({ ...params, sortBy: activeView.sub_platform === 'video' ? 'viewable_impressions' : 'impressions', order: 'desc' }),
      dailyRequest,
      linkedInSummaryRequest,
    ])
      .then(([s, c, h, l, p, a, d, li]) => {
        setSummary(s.data);
        setCampaigns(c.data);
        setHighlights(h.data);
        setTopLocations(l.data.rows || []);
        setTopPlacements(p.data.rows || []);
        setTopAds(a.data || []);
        setDailyRows(d.data.rows || []);
        setLinkedInSummary(li.data);
        setActiveAdIndex(0);
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false));
  }, [activeViewKey, periods, platform, activePeriod?.id]);

  const rangeMeta = buildRangeMeta(activePeriod, selectedStartDate, selectedEndDate);
  const {
    startDate: rangeStartDate,
    endDate: rangeEndDate,
    selectedDays,
    factor: rangeFactor,
    label: rangeLabel,
  } = rangeMeta;
  const currency = summary?.currency;
  const hasActiveData = activeView && periods.some((period) => viewKey(period) === activeView.key);
  const isVideoView  = activeView?.sub_platform === 'video';
  const isYoutubeView = activeView?.platform === 'google' && activeView?.sub_platform === 'video';
  const isGoogleDisplayView = activeView?.platform === 'google' && activeView?.sub_platform === 'display';
  const isLinkedInView = activeView?.platform === 'linkedin';
  const isLinkedInImageView = activeView?.platform === 'linkedin' && activeView?.sub_platform === 'image';
  const isLinkedInVideoView = activeView?.platform === 'linkedin' && activeView?.sub_platform === 'video';
  const displayDailyRows = isGoogleDisplayView ? buildDisplayDailyRows(activePeriod, summary?.total || {}) : [];
  const metricFactors = isYoutubeView ? dailyMetricFactors(dailyRows, rangeStartDate, rangeEndDate) : null;
  const total = scaleMetricRowWithFactors(summary?.total || {}, metricFactors, rangeFactor);
  const linkedInSummaryTotal = isLinkedInView ? scaleMetricRow(linkedInSummary?.total || {}, rangeFactor) : null;
  const linkedInVideoSummary = isLinkedInView
    ? scaleMetricRow((linkedInSummary?.platforms || []).find((row) => row.sub_platform === 'video') || {}, rangeFactor)
    : null;
  const linkedInReach = isLinkedInView
    ? scaleNumber(isLinkedInVideoView ? LINKEDIN_VIDEO_REACH : LINKEDIN_PRESENTATION_REACH, rangeFactor)
    : 0;
  const rangeCampaigns = campaigns.map((campaign) => scaleMetricRowWithFactors(campaign, metricFactors, rangeFactor));
  const totalViews = metricFactors
    ? scaleNumber(campaigns.reduce((sum, c) => sum + (c.viewable_impressions || 0), 0), metricFactors.viewable_impressions ?? rangeFactor)
    : scaleNumber(campaigns.reduce((sum, c) => sum + (c.viewable_impressions || 0), 0), rangeFactor);
  const locationMetricFactors = isYoutubeView && metricFactors
    ? { ...metricFactors, impressions: metricFactors.viewable_impressions }
    : metricFactors;
  const youtubeSelectedViewRate = isYoutubeView && total.impressions
    ? totalViews / total.impressions
    : YOUTUBE_VIEW_RATE;
  const scaleDashboardLocation = (location) => {
    const scaled = scaleMetricRowWithFactors(location, locationMetricFactors, rangeFactor);
    if (!isYoutubeView) return scaled;
    const estimatedImpressions = youtubeSelectedViewRate
      ? Math.round((scaled.impressions || 0) / youtubeSelectedViewRate)
      : 0;
    return {
      ...scaled,
      estimated_impressions: estimatedImpressions,
      ctr: estimatedImpressions ? Number(((scaled.clicks || 0) * 100 / estimatedImpressions).toFixed(2)) : 0,
      avg_cpm: estimatedImpressions ? Number(((scaled.cost || 0) * 1000 / estimatedImpressions).toFixed(2)) : 0,
    };
  };
  const rangeAds = topAds.map((ad) => scaleMetricRowWithFactors(ad, metricFactors, rangeFactor));
  const rangeTopAds = rangeAds.slice(0, 5);
  const rangeTopLocations = topLocations.map(scaleDashboardLocation);
  const rangeTopPlacements = topPlacements.map((placement) => scaleMetricRowWithFactors(placement, metricFactors, rangeFactor));
  const rangeHighlights = highlights ? {
    ...highlights,
    topLocation: highlights.topLocation ? scaleDashboardLocation(highlights.topLocation) : null,
    topPlacement: highlights.topPlacement ? scaleMetricRowWithFactors(highlights.topPlacement, metricFactors, rangeFactor) : null,
    topAd: highlights.topAd ? scaleMetricRowWithFactors(highlights.topAd, metricFactors, rangeFactor) : null,
    topAdByCtr: highlights.topAdByCtr ? scaleMetricRowWithFactors(highlights.topAdByCtr, metricFactors, rangeFactor) : null,
  } : null;
  const topLocationHighlight = rangeHighlights?.topLocation;
  const topLocationSubtitle = topLocationHighlight
    ? isYoutubeView
      ? `Avg CPV ${money(topLocationHighlight.impressions ? topLocationHighlight.cost / topLocationHighlight.impressions : null, topLocationHighlight.currency || currency)}`
      : topLocationHighlight.clicks === 0
        ? `Avg CPV ${money(topLocationHighlight.impressions ? topLocationHighlight.cost / topLocationHighlight.impressions : null, topLocationHighlight.currency || currency)}`
        : `Avg CPC ${money(topLocationHighlight.avg_cpc, topLocationHighlight.currency || currency)}`
    : '';
  const topLocationStats = topLocationHighlight
    ? isYoutubeView
      ? [
          ['Views', fmt(topLocationHighlight.impressions)],
          ['Clicks', fmt(topLocationHighlight.clicks)],
          ['CTR', pctOrDash(topLocationHighlight.ctr)],
          ['Cost', money(topLocationHighlight.cost, topLocationHighlight.currency || currency)],
        ]
      : topLocationHighlight.clicks === 0
        ? [
            ['Views', fmt(topLocationHighlight.impressions)],
            ['Cost', money(topLocationHighlight.cost, topLocationHighlight.currency || currency)],
          ]
        : [
            ['Impressions', fmt(topLocationHighlight.impressions)],
            ['Clicks', fmt(topLocationHighlight.clicks)],
            ['CTR', pctOrDash(topLocationHighlight.ctr)],
            ['Cost', money(topLocationHighlight.cost, topLocationHighlight.currency || currency)],
          ]
    : [];
  const activeLocationCount = periods
    .filter((period) => activeView && viewKey(period) === activeView.key)
    .reduce((sum, period) => sum + (period.location_count || 0), 0);
  const avgCpv = isVideoView && totalViews ? total.cost / totalViews : null;
  const carouselIndex = rangeTopAds.length ? Math.min(activeAdIndex, rangeTopAds.length - 1) : 0;
  const showPreviousAd = () => {
    setActiveAdIndex((index) => rangeTopAds.length ? (index - 1 + rangeTopAds.length) % rangeTopAds.length : 0);
  };
  const showNextAd = () => {
    setActiveAdIndex((index) => rangeTopAds.length ? (index + 1) % rangeTopAds.length : 0);
  };
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

  return (
    <div style={styles.shell}>
      <div style={styles.overviewBar}>
        <div style={styles.overviewLeft}>
          <h1 style={styles.pageTitle}>Overview</h1>
          <AdTypeTabs views={availableViews} activeKey={activeViewKey} onChange={(key) => setSelectedAdType(platform, key.split(':')[1])} />
        </div>
        <DateRangePanel
          startDate={rangeStartDate}
          endDate={rangeEndDate}
          minDate={importedStartDate}
          maxDate={importedEndDate}
          disabled={!activePeriod}
          onStartChange={handleStartDateChange}
          onEndChange={handleEndDateChange}
        />
      </div>

      {error && <div className="error-msg" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <div style={styles.centered}><div className="spinner" /></div>
      ) : !hasActiveData ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
          <p style={{ marginBottom: '.75rem', fontWeight: 600, color: '#334155' }}>No reports imported yet.</p>
          <p>Drop CSV exports into <code>backend/data/imports/&lt;platform&gt;-&lt;sub&gt;/</code> and run <code>npm run import</code>.</p>
        </div>
      ) : isLinkedInImageView ? (
        <LinkedInImageDashboard
          total={total}
          imageTotal={total}
          reach={linkedInReach}
          ads={rangeAds}
          period={activePeriod}
          rawTotal={summary?.total || {}}
          startDate={rangeStartDate}
          endDate={rangeEndDate}
          selectedDays={selectedDays}
          rangeFactor={rangeFactor}
          currency={currency}
        />
      ) : isLinkedInVideoView ? (
        <LinkedInVideoDashboard
          total={total}
          reach={linkedInReach}
          ads={rangeAds}
          period={activePeriod}
          rawTotal={summary?.total || {}}
          startDate={rangeStartDate}
          endDate={rangeEndDate}
          rangeFactor={rangeFactor}
          currency={currency}
        />
      ) : (
        <>
          {isLinkedInView && linkedInSummaryTotal?.impressions > 0 && (
            <LinkedInSummaryCard
              total={linkedInSummaryTotal}
              videoTotal={linkedInVideoSummary}
              reach={linkedInReach}
              currency={linkedInSummary?.currency || currency}
            />
          )}

          {!isYoutubeView && !isGoogleDisplayView && (
            <div className="card" style={styles.overviewCard}>
              <div style={styles.cardHeader}>
                <div>
                  <h2 style={styles.cardTitle}>Performance summary</h2>
                  <p style={styles.pageSubtitle}>
                    {activeView?.label || 'Campaigns'} · {rangeLabel}
                  </p>
                </div>
                <span style={styles.statusPill}>Paused</span>
              </div>
              <div style={styles.kpiGrid}>
                <KpiCard title="Impressions" value={compact(total.impressions)} tooltip={fmt(total.impressions)} background={theme.kpis[0]} />
                {isVideoView && (
                  <KpiCard title="Views" value={compact(totalViews)} tooltip={fmt(totalViews)} background={theme.kpis[4]} />
                )}
                <KpiCard title="Clicks"      value={compact(total.clicks)}      tooltip={fmt(total.clicks)} background={theme.kpis[1]} />
                <KpiCard title="Avg. CPM"    value={money(total.cpm, currency)} tooltip={money(total.cpm, currency)} background={theme.kpis[2]} />
                <KpiCard title="Cost"        value={compactMoney(total.cost, currency)} tooltip={money(total.cost, currency)} background={theme.kpis[3]} />
              </div>

              <div style={styles.subStats}>
                <MetricInline label="CTR" value={pctOrDash(total.ctr)} />
                <MetricInline label={isVideoView ? 'Avg. CPV' : 'CPC'} value={isVideoView ? money(avgCpv, currency) : money(total.cpc, currency)} />
                <MetricInline label={isVideoView ? 'YouTube views' : 'Viewable impr.'} value={isVideoView ? fmt(totalViews) : fmt(rangeCampaigns[0]?.viewable_impressions)} />
                <MetricInline label="Selected spend" value={compactMoney(total.cost, currency)} />
              </div>
            </div>
          )}

          {isYoutubeView && dailyRows.length > 0 && (
            <GooglePerformanceChart
              rows={dailyRows}
              startDate={rangeStartDate}
              endDate={rangeEndDate}
              currency={currency}
              metrics={youtubePerformanceMetrics}
            />
          )}

          {isGoogleDisplayView && displayDailyRows.length > 0 && (
            <GooglePerformanceChart
              rows={displayDailyRows}
              startDate={rangeStartDate}
              endDate={rangeEndDate}
              currency={currency}
              metrics={displayPerformanceMetrics}
            />
          )}

          {/* Per-platform breakdown when more than one platform/sub-platform exists */}
          {summary?.platforms?.length > 1 && (
            <div className="card">
              <h3 style={styles.sectionTitle}>By Platform</h3>
              <div style={styles.platformGrid}>
                {summary.platforms.map((p) => (
                  <div key={`${p.platform}-${p.sub_platform}`} style={styles.platformCell}>
                    <div style={styles.platformName}>{platformLabel(p.platform, p.sub_platform)}</div>
                    <div style={styles.platformRow}>
                      <span>Impr</span><strong>{fmt(p.impressions)}</strong>
                    </div>
                    <div style={styles.platformRow}>
                      <span>Clicks</span><strong>{fmt(p.clicks)}</strong>
                    </div>
                    <div style={styles.platformRow}>
                      <span>Cost</span><strong>{money(p.cost, p.currency)}</strong>
                    </div>
                    <div style={styles.platformRow}>
                      <span>CTR</span><strong>{pctOrDash(p.ctr)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rangeTopAds.length > 0 && (
            <TopAdsCarousel
              ads={rangeTopAds}
              activeIndex={carouselIndex}
              onPrevious={showPreviousAd}
              onNext={showNextAd}
              onSelect={setActiveAdIndex}
            />
          )}

          {rangeHighlights && (topLocationHighlight || rangeHighlights.topPlacement) && (
            <div>
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>Performance snapshots</h3>
              </div>
              <div style={styles.highlightsGrid}>
                {topLocationHighlight && (
                  <HighlightCard
                    badge="Top Location"
                    badgeColor={theme.success}
                    title={cleanLocation(topLocationHighlight.location)}
                    subtitle={topLocationSubtitle}
                    linkTo="/locations"
                    stats={topLocationStats}
                  />
                )}

                {rangeHighlights.topPlacement && (
                  <HighlightCard
                    badge="Top Placement"
                    badgeColor={theme.tertiary}
                    title={prettyPlacement(rangeHighlights.topPlacement.placement)}
                    subtitle={rangeHighlights.topPlacement.placement_type || '—'}
                    linkTo="/placements"
                    stats={[
                      ['Impressions', fmt(rangeHighlights.topPlacement.impressions)],
                      [
                        isYoutubeView ? 'VTR' : 'CTR',
                        isYoutubeView
                          ? pctOrDash(rangeHighlights.topPlacement.trueview_view_rate)
                          : pctOrDash(rangeHighlights.topPlacement.ctr),
                      ],
                      ['Cost',        money(rangeHighlights.topPlacement.cost, rangeHighlights.topPlacement.currency || currency)],
                    ]}
                  />
                )}
              </div>
            </div>
          )}

          {(rangeTopLocations.length > 0 || rangeTopPlacements.length > 0) && (
            <div style={styles.topFiveGrid}>
              <TopFiveCard
                title="Top 4 Locations"
                linkTo="/locations"
                rows={rangeTopLocations}
                renderName={(row) => cleanLocation(row.location)}
                currency={currency}
                metricLabel={isYoutubeView ? 'views' : rangeTopLocations[0]?.clicks === 0 ? 'views' : 'impressions'}
              />
              <TopFiveCard
                title="Top 5 Placements"
                linkTo="/placements"
                rows={rangeTopPlacements}
                renderName={(row) => prettyPlacement(row.placement)}
                currency={currency}
                showClicks={false}
              />
            </div>
          )}

          <div id="in-depth-analytics" style={styles.inDepthAnchor}>
            <CampaignTable campaigns={rangeCampaigns} currency={currency} />
          </div>

          <div className="card" style={styles.geoTeaser}>
            <div>
              <h3 style={styles.sectionTitle}>Geo Performance</h3>
              <p style={{ fontSize: '.85rem', color: '#64748b' }}>
                {activeLocationCount ? `${activeLocationCount} locations targeted` : 'Per-location breakdown'}
              </p>
            </div>
            <Link to="/locations" className="btn btn-primary">View locations</Link>
          </div>
        </>
      )}
    </div>
  );
}

function LinkedInImageDashboard({
  total,
  imageTotal,
  reach,
  ads,
  period,
  rawTotal,
  startDate,
  endDate,
  selectedDays,
  rangeFactor,
  currency,
}) {
  const chartRows = buildLinkedInImageDailyRows(period, rawTotal, LINKEDIN_PRESENTATION_REACH);
  const topAdSet = buildLinkedInTopAdSet(ads, selectedDays, rangeFactor);
  const adSetRows = buildLinkedInAdSetRows(ads, imageTotal, selectedDays, rangeFactor);
  const topAds = buildLinkedInTopImageAds(ads, reach, rangeFactor);
  const dateRangeLabel = formatSlashDateRange(startDate, endDate);

  return (
    <div style={styles.linkedinImageDashboard}>
      <div style={styles.linkedinImageKpiGrid}>
        <LinkedInImageKpi label="Reach" value={linkedInExactCompact(reach)} tooltip={fmt(reach)} />
        <LinkedInImageKpi label="Impressions" value={linkedInExactCompact(total.impressions)} tooltip={fmt(total.impressions)} />
        <LinkedInImageKpi label="Avg. CPM" value={linkedInRoundedMoney(total.cpm, currency)} tooltip={money(total.cpm, currency)} />
        <LinkedInImageKpi label="Total cost" value={linkedInCompactMoney(total.cost, currency)} tooltip={money(total.cost, currency)} />
      </div>

      <LinkedInImagePerformance
        rows={chartRows}
        total={total}
        reach={reach}
        startDate={startDate}
        endDate={endDate}
        currency={currency}
      />

      {topAdSet && <LinkedInTopAdSetCard adSet={topAdSet} adSets={adSetRows} total={imageTotal} currency={currency} />}
      {topAds.length > 0 && <LinkedInTopAdsCard ads={topAds} currency={currency} />}
      <LinkedInTopAudiencesCard rangeFactor={rangeFactor} adType="image" dateRangeLabel={dateRangeLabel} />
    </div>
  );
}

function LinkedInVideoDashboard({
  total,
  reach,
  ads,
  period,
  rawTotal,
  startDate,
  endDate,
  rangeFactor,
  currency,
}) {
  const chartRows = buildLinkedInVideoDailyRows(period, rawTotal, LINKEDIN_VIDEO_REACH);
  const videoViews = total.viewable_impressions || 0;
  const cpv = videoViews ? total.cost / videoViews : null;
  const topVideoAds = buildLinkedInTopVideoAds(ads, reach, rangeFactor);
  const dateRangeLabel = formatSlashDateRange(startDate, endDate);

  return (
    <div style={styles.linkedinImageDashboard}>
      <div style={styles.linkedinImageKpiGrid}>
        <LinkedInImageKpi label="Views" value={linkedInExactCompact(videoViews)} tooltip={fmt(videoViews)} />
        <LinkedInImageKpi label="Impressions" value={linkedInExactCompact(total.impressions)} tooltip={fmt(total.impressions)} />
        <LinkedInImageKpi label="Avg. CPM" value={linkedInRoundedMoney(total.cpm, currency)} tooltip={money(total.cpm, currency)} />
        <LinkedInImageKpi label="Total spend" value={linkedInCompactMoney(total.cost, currency)} tooltip={money(total.cost, currency)} />
        <LinkedInImageKpi label="CPV" value={money(cpv, currency)} tooltip={money(cpv, currency)} />
      </div>

      <LinkedInImagePerformance
        rows={chartRows}
        total={total}
        reach={reach}
        startDate={startDate}
        endDate={endDate}
        currency={currency}
        metricOptions={LINKEDIN_VIDEO_METRIC_OPTIONS}
        defaultMetric1="reach"
        defaultMetric2="video_views"
        videoViews={videoViews}
      />

      {topVideoAds.length > 0 && <LinkedInTopVideoAdsCard ads={topVideoAds} currency={currency} />}
      <LinkedInTopAudiencesCard rangeFactor={rangeFactor} adType="video" dateRangeLabel={dateRangeLabel} />
    </div>
  );
}

function LinkedInImageKpi({ label, value, tooltip, info = false }) {
  return (
    <div style={styles.linkedinImageKpi}>
      <div style={styles.linkedinImageKpiLabel}>
        <span>{label}</span>
        {info && <span style={styles.linkedinInfoIcon}>i</span>}
      </div>
      {tooltip ? (
        <TooltipValue as="strong" valueStyle={styles.linkedinImageKpiValue} tooltip={tooltip}>
          {value}
        </TooltipValue>
      ) : (
        <strong style={styles.linkedinImageKpiValue}>{value}</strong>
      )}
    </div>
  );
}

const LINKEDIN_METRIC_OPTIONS = [
  {
    key: 'reach',
    label: 'Reach',
    axis: 'log',
    totalFromRow: (_row, totals) => totals.reach,
    fmtValue: (v) => linkedInExactCompact(v),
    fmtTooltip: (v) => fmt(v),
    fmtAxis: (v) => linkedInAxisNumber(v),
  },
  {
    key: 'clicks',
    label: 'Clicks',
    axis: 'log',
    totalFromRow: (_row, totals) => totals.clicks,
    fmtValue: (v) => linkedInExactCompact(v),
    fmtTooltip: (v) => fmt(v),
    fmtAxis: (v) => linkedInAxisNumber(v),
  },
  {
    key: 'impressions',
    label: 'Impressions',
    axis: 'log',
    totalFromRow: (_row, totals) => totals.impressions,
    fmtValue: (v) => linkedInExactCompact(v),
    fmtTooltip: (v) => fmt(v),
    fmtAxis: (v) => linkedInAxisNumber(v),
  },
  {
    key: 'ctr',
    label: 'Click through rate',
    axis: 'linear',
    totalFromRow: (row, totals) => (totals.impressions ? (totals.clicks * 100) / totals.impressions : 0),
    fmtValue: (v) => `${Number(v || 0).toFixed(2)}%`,
    fmtTooltip: (v) => `${Number(v || 0).toFixed(2)}%`,
    fmtAxis: (v) => `${Number(v || 0).toFixed(2)}%`,
  },
  {
    key: 'cpc',
    label: 'CPC',
    axis: 'linear',
    totalFromRow: (row, totals) => (totals.clicks ? totals.cost / totals.clicks : 0),
    fmtValue: (v, ccy) => money(v, ccy),
    fmtTooltip: (v, ccy) => money(v, ccy),
    fmtAxis: (v, ccy) => linkedInAxisMoney(v, ccy),
  },
  {
    key: 'dwell_time',
    label: 'Dwell time',
    axis: 'linear',
    totalFromRow: () => LINKEDIN_DWELL_TIME,
    fmtValue: (v) => Number(v || 0).toFixed(2),
    fmtTooltip: (v) => Number(v || 0).toFixed(2),
    fmtAxis: (v) => Number(v || 0).toFixed(0),
  },
];

const LINKEDIN_VIDEO_METRIC_OPTIONS = [
  {
    key: 'reach',
    label: 'Reach',
    axis: 'linear',
    totalFromRow: (_row, totals) => totals.reach,
    fmtValue: (v) => linkedInExactCompact(v),
    fmtTooltip: (v) => fmt(v),
    fmtAxis: (v) => linkedInAxisNumber(v),
  },
  {
    key: 'impressions',
    label: 'Impressions',
    axis: 'linear',
    totalFromRow: (_row, totals) => totals.impressions,
    fmtValue: (v) => linkedInExactCompact(v),
    fmtTooltip: (v) => fmt(v),
    fmtAxis: (v) => linkedInAxisNumber(v),
  },
  {
    key: 'video_views',
    label: 'Video views',
    axis: 'linear',
    totalFromRow: (_row, totals) => totals.video_views,
    fmtValue: (v) => linkedInExactCompact(v),
    fmtTooltip: (v) => fmt(v),
    fmtAxis: (v) => linkedInAxisNumber(v),
  },
  {
    key: 'ctr',
    label: 'Click through rate',
    axis: 'linear',
    totalFromRow: (_row, totals) => (totals.impressions ? (totals.clicks * 100) / totals.impressions : 0),
    fmtValue: (v) => `${Number(v || 0).toFixed(2)}%`,
    fmtTooltip: (v) => `${Number(v || 0).toFixed(2)}%`,
    fmtAxis: (v) => `${Number(v || 0).toFixed(2)}%`,
  },
  {
    key: 'cpc',
    label: 'CPC',
    axis: 'log',
    totalFromRow: (_row, totals) => (totals.clicks ? totals.cost / totals.clicks : 0),
    fmtValue: (v, ccy) => money(v, ccy),
    fmtTooltip: (v, ccy) => money(v, ccy),
    fmtAxis: (v, ccy) => linkedInAxisMoney(v, ccy),
  },
  {
    key: 'cpm',
    label: 'CPM',
    axis: 'linear',
    totalFromRow: (_row, totals) => (totals.impressions ? (totals.cost * 1000) / totals.impressions : 0),
    fmtValue: (v, ccy) => money(v, ccy),
    fmtTooltip: (v, ccy) => money(v, ccy),
    fmtAxis: (v, ccy) => linkedInAxisMoney(v, ccy),
  },
];

const LINKEDIN_METRIC_COLORS = ['#174A8B', '#E45D48'];

function findMetric(key, options = LINKEDIN_METRIC_OPTIONS) {
  return options.find((m) => m.key === key) || options[0];
}

function LinkedInImagePerformance({
  rows,
  total,
  reach,
  startDate,
  endDate,
  currency,
  metricOptions = LINKEDIN_METRIC_OPTIONS,
  defaultMetric1 = 'reach',
  defaultMetric2 = 'dwell_time',
  videoViews = 0,
}) {
  const [metric1Key, setMetric1Key] = useState(defaultMetric1);
  const [metric2Key, setMetric2Key] = useState(defaultMetric2);
  const [showSpend, setShowSpend] = useState(true);

  const chartRows = rows.filter((row) => row.date >= startDate && row.date <= endDate);
  const totals = {
    reach,
    clicks: total.clicks || 0,
    impressions: total.impressions || 0,
    video_views: videoViews || total.viewable_impressions || 0,
    cost: total.cost || 0,
  };

  const metric1 = findMetric(metric1Key, metricOptions);
  const metric2 = findMetric(metric2Key, metricOptions);
  const m1Total = metric1.totalFromRow(null, totals);
  const m2Total = metric2.totalFromRow(null, totals);

  const seriesValues = (m) => chartRows.map((row) => {
    const v = Number(row[m.key] || 0);
    return m.axis === 'log' ? Math.max(v, 1) : v;
  });

  const datasets = [
    {
      label: metric1.label,
      data: seriesValues(metric1),
      borderColor: LINKEDIN_METRIC_COLORS[0],
      backgroundColor: LINKEDIN_METRIC_COLORS[0],
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0.25,
      rawKey: metric1.key,
      fmt: metric1.fmtTooltip,
      yAxisID: 'y',
    },
    {
      label: metric2.label,
      data: seriesValues(metric2),
      borderColor: LINKEDIN_METRIC_COLORS[1],
      backgroundColor: LINKEDIN_METRIC_COLORS[1],
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0.25,
      rawKey: metric2.key,
      fmt: metric2.fmtTooltip,
      yAxisID: 'y2',
    },
  ];

  if (showSpend) {
    datasets.push({
      label: 'Spend',
      data: chartRows.map((row) => row.cost),
      borderColor: '#A66BFF',
      backgroundColor: '#A66BFF',
      borderDash: [6, 4],
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
      tension: 0.25,
      rawKey: 'cost',
      fmt: (value, ccy) => money(value, ccy),
      yAxisID: 'y1',
    });
  }

  const axisFor = (m) => {
    if (m.axis === 'log') {
      return {
        type: 'logarithmic',
        min: 10,
        grid: { color: '#E5E7EB' },
        ticks: { color: '#6B7280', callback: (v) => m.fmtAxis(v, currency) },
      };
    }
    return {
      type: 'linear',
      min: 0,
      grid: { color: '#E5E7EB' },
      ticks: { color: '#6B7280', callback: (v) => m.fmtAxis(v, currency) },
    };
  };

  const scales = {
    x: {
      grid: { display: false },
      ticks: { maxTicksLimit: 7, color: '#6B7280', font: { size: 11 } },
    },
    y: axisFor(metric1),
    y2: { ...axisFor(metric2), display: false, position: 'right' },
  };

  if (showSpend) {
    scales.y1 = {
      position: 'right',
      min: 0,
      suggestedMax: 16000,
      grid: { display: false },
      ticks: {
        color: '#A66BFF',
        callback: (value) => linkedInAxisMoney(value, currency),
      },
    };
  }

  return (
    <section className="card" style={styles.linkedinPerformanceCard}>
      <div style={styles.linkedinPerformanceHeader}>
        <h2 style={styles.linkedinBlockTitle}>Performance</h2>
        <p style={styles.linkedinBlockSubtitle}>Compare key metrics over the selected time range to discover trends and insights</p>
      </div>

      <div style={styles.linkedinMetricSelectorRow}>
        <LinkedInMetricSelector
          color={LINKEDIN_METRIC_COLORS[0]}
          metric={metric1}
          value={metric1.fmtValue(m1Total, currency)}
          tooltip={metric1.fmtTooltip(m1Total, currency)}
          onChange={setMetric1Key}
          disabledKey={metric2Key}
          options={metricOptions}
        />
        <LinkedInMetricSelector
          color={LINKEDIN_METRIC_COLORS[1]}
          metric={metric2}
          value={metric2.fmtValue(m2Total, currency)}
          tooltip={metric2.fmtTooltip(m2Total, currency)}
          onChange={setMetric2Key}
          disabledKey={metric1Key}
          options={metricOptions}
        />
      </div>

      <div style={styles.linkedinChartToolbar}>
        <label style={styles.linkedinSpendToggle}>
          <input
            type="checkbox"
            checked={showSpend}
            onChange={(e) => setShowSpend(e.target.checked)}
            style={styles.linkedinSpendCheckbox}
          />
          <span style={styles.linkedinSpendDash} />
          <strong>Show spend</strong>
          <span>({linkedInOneDecimalMoney(total.cost, currency)})</span>
        </label>
      </div>

      <div style={styles.linkedinChartWrap}>
        <Line
          data={{ labels: chartRows.map((row) => formatLinkedInTickDate(row.date)), datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: (items) => chartRows[items[0]?.dataIndex]?.date || '',
                  label: (item) => {
                    const dataset = item.dataset;
                    const row = chartRows[item.dataIndex];
                    const rawValue = row?.[dataset.rawKey] ?? 0;
                    return `${dataset.label}: ${dataset.fmt(rawValue, currency)}`;
                  },
                },
              },
            },
            scales,
          }}
        />
      </div>
    </section>
  );
}

function LinkedInMetricSelector({ color, metric, value, tooltip, onChange, disabledKey, options = LINKEDIN_METRIC_OPTIONS }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={styles.linkedinMetricSelector}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        style={styles.linkedinMetricSelectorBtn}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ ...styles.linkedinMetricLine, background: color }} />
        <span>{metric.label}</span>
        <span style={styles.linkedinCaret} />
      </button>
      {open && (
        <ul role="listbox" style={styles.linkedinMetricMenu}>
          {options.map((opt) => {
            const isDisabled = opt.key === disabledKey;
            const isSelected = opt.key === metric.key;
            return (
              <li
                key={opt.key}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (isDisabled) return;
                  onChange(opt.key);
                  setOpen(false);
                }}
                style={{
                  ...styles.linkedinMetricMenuItem,
                  ...(isSelected ? styles.linkedinMetricMenuItemSelected : {}),
                  ...(isDisabled ? styles.linkedinMetricMenuItemDisabled : {}),
                }}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
      <TooltipValue as="strong" valueStyle={styles.linkedinMetricSelectorValue} tooltip={tooltip}>
        {value}
      </TooltipValue>
    </div>
  );
}

function LinkedInTopAdSetCard({ adSet, adSets, currency }) {
  const rows = adSets?.length ? adSets : [adSet];

  return (
    <section className="card" style={styles.linkedinBlockCard}>
      <h2 style={styles.linkedinBlockTitle}>Top-performing ad sets</h2>
      <p style={styles.linkedinBlockSubtitle}>These ad sets receive the highest key result at each ad set objective.</p>

      <div style={styles.linkedinSimpleTableWrap}>
        <table style={styles.linkedinSimpleTable}>
          <thead>
            <tr>
              <th style={styles.linkedinSimpleTh}>Content</th>
              <th style={styles.linkedinSimpleTh}>Key result</th>
              <th style={styles.linkedinSimpleTh}>Cost / 1K reach</th>
              <th style={styles.linkedinSimpleTh}>CPC</th>
              <th style={styles.linkedinSimpleTh}>CTR</th>
              <th style={styles.linkedinSimpleTh}>CPM</th>
              <th style={styles.linkedinSimpleTh}>Impressions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} style={styles.linkedinSimpleTr}>
                <td style={styles.linkedinSimpleNameTd}>
                  <Link to="/ads" style={styles.linkedinLargeBlueLink}>{row.name}</Link>
                  <span>Brand Awareness Ad Set</span>
                </td>
                <td style={styles.linkedinSimpleTd}>{linkedInReachResult(row.reach)}</td>
                <td style={styles.linkedinSimpleTd}>
                  <div>{money(row.costPerResult, currency)}</div>
                </td>
                <td style={styles.linkedinSimpleTd}>{money(row.cpc, currency)}</td>
                <td style={styles.linkedinSimpleTd}>{pct(row.ctr)}</td>
                <td style={styles.linkedinSimpleTd}>{money(row.cpm, currency)}</td>
                <td style={styles.linkedinSimpleTd}>{fmt(row.impressions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link to="/ads" style={styles.linkedinFooterLink}>View all ad sets <span>-&gt;</span></Link>
    </section>
  );
}

function LinkedInEducationCompaniesCard({ companies }) {
  if (!companies?.length) return null;
  const totals = companies.reduce((acc, company) => {
    acc.paid_impressions += company.paid_impressions || 0;
    acc.paid_video_views += company.paid_video_views || 0;
    return acc;
  }, { paid_impressions: 0, paid_video_views: 0 });

  return (
    <section className="card" style={styles.linkedinBlockCard}>
      <div style={styles.linkedinCompaniesHeader}>
        <div>
          <h2 style={styles.linkedinBlockTitle}>Education companies where ads showed</h2>
          <p style={styles.linkedinBlockSubtitle}>
            Filtered from the LinkedIn company export. Non-education companies are excluded.
          </p>
        </div>
        <div style={styles.linkedinCompaniesSummary}>
          <strong>{fmt(companies.length)}</strong>
          <span>education companies</span>
        </div>
      </div>

      <div style={styles.linkedinCompanyTotals}>
        <MetricInline label="Paid impressions" value={fmt(totals.paid_impressions)} />
        <MetricInline label="Paid video views" value={fmt(totals.paid_video_views)} />
      </div>

      <div style={styles.linkedinCompaniesTableWrap}>
        <table style={styles.linkedinCompaniesTable}>
          <thead>
            <tr>
              <th style={styles.linkedinCompaniesTh}>Company</th>
              <th style={styles.linkedinCompaniesTh}>Engagement</th>
              <th style={styles.linkedinCompaniesThNum}>Paid impr.</th>
              <th style={styles.linkedinCompaniesThNum}>Video views</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.company_page_url || company.company_name} style={styles.linkedinCompanyRow}>
                <td style={styles.linkedinCompanyNameTd}>
                  <a href={company.company_page_url} target="_blank" rel="noreferrer" style={styles.linkedinBlueLink}>
                    {company.company_name}
                  </a>
                </td>
                <td style={styles.linkedinCompaniesTd}>{company.engagement_level || '-'}</td>
                <td style={styles.linkedinCompaniesTdNum}>{fmt(company.paid_impressions)}</td>
                <td style={styles.linkedinCompaniesTdNum}>{company.paid_video_views ? fmt(company.paid_video_views) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LinkedInTopAdsCard({ ads, currency }) {
  return (
    <section className="card" style={styles.linkedinBlockCard}>
      <h2 style={styles.linkedinBlockTitle}>Top-performing ads</h2>
      <p style={styles.linkedinBlockSubtitle}>These ads received the highest key results at each ad set objective</p>

      <div style={styles.linkedinSimpleTableWrap}>
        <table style={styles.linkedinSimpleTable}>
          <thead>
            <tr>
              <th style={styles.linkedinSimpleTh}>Content</th>
              <th style={styles.linkedinSimpleTh}>Key result</th>
              <th style={styles.linkedinSimpleTh}>Cost / 1K reach</th>
              <th style={styles.linkedinSimpleTh}>CPC</th>
              <th style={styles.linkedinSimpleTh}>CTR</th>
              <th style={styles.linkedinSimpleTh}>CPM</th>
              <th style={styles.linkedinSimpleTh}>Impressions</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => {
              const image = adImageUrl(ad);
              return (
                <tr key={ad.image_filename || ad.id} style={styles.linkedinSimpleTr}>
                  <td style={styles.linkedinTopAdTd}>
                    <div style={styles.linkedinTopAdThumbWrap}>
                      {image ? <img src={image} alt="" style={styles.linkedinTopAdThumb} loading="lazy" /> : null}
                      <span style={styles.linkedinImageOverlay}>▧</span>
                    </div>
                    <div style={styles.linkedinTopAdCopy}>
                      <Link to="/ads" style={styles.linkedinTopAdTitle}>{ad.title}</Link>
                      <span>Single Image ad</span>
                    </div>
                  </td>
                  <td style={styles.linkedinSimpleTd}>{linkedInReachResult(ad.reach)}</td>
                  <td style={styles.linkedinSimpleTd}>{money(ad.costPerResult, currency)}</td>
                  <td style={styles.linkedinSimpleTd}>{money(ad.avg_cpc, currency)}</td>
                  <td style={styles.linkedinSimpleTd}>{pct(ad.ctr)}</td>
                  <td style={styles.linkedinSimpleTd}>{money(ad.avg_cpm, currency)}</td>
                  <td style={styles.linkedinSimpleTd}>{fmt(ad.impressions)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Link to="/ads" style={styles.linkedinFooterLink}>View all ads <span>-&gt;</span></Link>
    </section>
  );
}

function LinkedInTopVideoAdsCard({ ads, currency }) {
  return (
    <section className="card" style={styles.linkedinBlockCard}>
      <h2 style={styles.linkedinBlockTitle}>Top-performing video ads</h2>
      <p style={styles.linkedinBlockSubtitle}>These video ads received the highest video views in the selected range.</p>

      <div style={styles.linkedinSimpleTableWrap}>
        <table style={styles.linkedinSimpleTable}>
          <thead>
            <tr>
              <th style={styles.linkedinSimpleTh}>Content</th>
              <th style={styles.linkedinSimpleTh}>Video views</th>
              <th style={styles.linkedinSimpleTh}>Impressions</th>
              <th style={styles.linkedinSimpleTh}>Cost</th>
              <th style={styles.linkedinSimpleTh}>CPV</th>
              <th style={styles.linkedinSimpleTh}>CTR</th>
            </tr>
          </thead>
          <tbody>
            {ads.map((ad) => {
              const image = adImageUrl(ad);
              return (
                <tr key={ad.id} style={styles.linkedinSimpleTr}>
                  <td style={styles.linkedinTopAdTd}>
                    <div style={styles.linkedinTopAdThumbWrap}>
                      {image ? <img src={image} alt="" style={styles.linkedinTopAdThumb} loading="lazy" /> : null}
                      <span style={styles.linkedinVideoOverlay}>▶</span>
                    </div>
                    <div style={styles.linkedinTopAdCopy}>
                      <Link to="/ads" style={styles.linkedinTopAdTitle}>{linkedInVideoTitle(ad)}</Link>
                      <span>Video ad</span>
                    </div>
                  </td>
                  <td style={styles.linkedinSimpleTd}>{fmt(ad.viewable_impressions)}</td>
                  <td style={styles.linkedinSimpleTd}>{fmt(ad.impressions)}</td>
                  <td style={styles.linkedinSimpleTd}>{money(ad.cost, currency)}</td>
                  <td style={styles.linkedinSimpleTd}>{money(ad.cpv, currency)}</td>
                  <td style={styles.linkedinSimpleTd}>{pct(ad.ctr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Link to="/ads" style={styles.linkedinFooterLink}>View all ads <span>-&gt;</span></Link>
    </section>
  );
}

function LinkedInTopAudiencesCard({ rangeFactor, adType = 'image', dateRangeLabel }) {
  const [active, setActive] = useState('seniorities');
  const groups = adType === 'video' ? LINKEDIN_VIDEO_AUDIENCE_GROUPS : LINKEDIN_AUDIENCE_GROUPS;
  const group = groups[active] || groups.seniorities;

  return (
    <section className="card" style={styles.linkedinAudienceCard}>
      <h2 style={styles.linkedinBlockTitle}>Top-performing audiences</h2>
      <p style={styles.linkedinBlockSubtitle}>Discover the best-performing attributes in the selected ad sets.</p>

      <LinkedInCustomAudienceSummary rangeFactor={rangeFactor} adType={adType} dateRangeLabel={dateRangeLabel} />

      <div style={styles.linkedinAudienceToolbar}>
        <div style={styles.linkedinAudienceShow}>
          <span>Show:</span>
          <strong>Members attributes</strong>
          <span style={styles.linkedinCaret} />
        </div>
        <div style={styles.linkedinAudienceTabs}>
          {Object.entries(groups).map(([key, item]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActive(key)}
              style={{
                ...styles.linkedinAudienceTab,
                ...(active === key ? styles.linkedinAudienceTabActive : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.linkedinAudienceRows}>
        {group.rows.map(([label, percent, results]) => (
          <LinkedInAudienceRow
            key={label}
            label={label}
            percent={percent}
            results={scaleNumber(results, rangeFactor)}
          />
        ))}
      </div>
    </section>
  );
}

function LinkedInCustomAudienceSummary({ rangeFactor, adType = 'image', dateRangeLabel }) {
  const rows = LINKEDIN_CUSTOM_AUDIENCE_AD_SETS
    .filter((row) => row.adType === adType);
  const typeLabel = adType === 'video' ? 'video ads' : 'image ads';

  return (
    <div style={styles.customAudiencePanel}>
      <div style={styles.customAudienceHeader}>
        <div>
          <h3 style={styles.customAudienceTitle}>KLE Academy Custom audience</h3>
          <p style={styles.customAudienceSubtitle}>Created from KLE-provided contact-list data for LinkedIn {typeLabel}.</p>
        </div>
        <span style={styles.customAudienceBadge}>Custom audience</span>
      </div>

      <div style={styles.customAudienceMetrics}>
        {LINKEDIN_AUDIENCE_OVERVIEW.map(([value, label]) => (
          <div key={label} style={styles.customAudienceMetric}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div style={styles.customAudienceAdSetHeader}>
        <h4 style={styles.customAudienceAdSetTitle}>Paused ad sets using this audience</h4>
        <span>Time range: <strong>{dateRangeLabel || 'Selected range'}</strong></span>
      </div>
      <div style={styles.customAudienceTableWrap}>
        <table style={styles.customAudienceTable}>
          <thead>
            <tr>
              <th style={styles.customAudienceTh}>Ad set name</th>
              <th style={styles.customAudienceTh}>Objective type</th>
              <th style={styles.customAudienceTh}>Key results</th>
              <th style={styles.customAudienceTh}>Campaign</th>
              <th style={{ ...styles.customAudienceTh, textAlign: 'right' }}>Spent</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={styles.customAudienceTr}>
                <td style={styles.customAudienceNameTd}>
                  <Link to="/ads" style={styles.linkedinLargeBlueLink}>{row.name}</Link>
                  <span>ID: {row.id} · Sponsored Content</span>
                </td>
                <td style={styles.customAudienceTd}>Brand awareness</td>
                <td style={styles.customAudienceTd}>{linkedInReachResult(scaleNumber(row.reach, rangeFactor))}</td>
                <td style={styles.customAudienceTd}>{row.campaign}</td>
                <td style={{ ...styles.customAudienceTd, textAlign: 'right' }}>{money(scaleNumber(row.cost, rangeFactor, 2), 'INR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LinkedInAudienceRow({ label, percent, results }) {
  return (
    <div style={styles.linkedinAudienceRow}>
      <strong style={styles.linkedinAudienceName}>{label}</strong>
      <div style={styles.linkedinAudienceResultLine}>
        <span style={{ ...styles.linkedinAudienceBar, width: `${Math.max(22, percent * 12)}px` }} />
        <strong>{percent}%</strong>
        <span style={styles.linkedinAudienceDivider} />
        <span>{linkedInCompactAudience(results)} key results</span>
      </div>
    </div>
  );
}

function LinkedInResultCell({ label, value, subValue, positive = false }) {
  return (
    <div style={styles.linkedinResultCell}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subValue && <em style={positive ? styles.linkedinPositiveSub : styles.linkedinResultSub}>{subValue}</em>}
    </div>
  );
}

function LinkedInSummaryCard({ total, videoTotal, reach, currency }) {
  const spendValue = linkedInCompactMoney(total.cost, currency);
  const videoViews = videoTotal?.viewable_impressions || 0;
  const cpv = videoViews ? (videoTotal.cost || 0) / videoViews : 0;
  const metrics = [
    { label: 'Reach', value: compact(reach), tooltip: fmt(reach) },
    { label: 'Video views', value: compact(videoViews), tooltip: fmt(videoViews), caret: false },
    { label: 'CPC', value: linkedInRoundedMoney(total.cpc, currency), tooltip: money(total.cpc, currency) },
    { label: 'CPV', value: linkedInPreciseMoney(cpv, currency, 3), tooltip: linkedInPreciseMoney(cpv, currency, 3) },
  ];

  return (
    <div className="card" style={styles.linkedinSummaryCard}>
      <h2 style={styles.linkedinSummaryTitle}>Summary</h2>
      <div style={styles.linkedinSummaryBody}>
        <div style={styles.linkedinObjectiveColumn}>
          <div style={styles.linkedinMetricLabel}>
            <span style={styles.linkedinUnderlined}>Spend by objective</span>
          </div>
          <div style={styles.linkedinObjectiveContent}>
            <div style={styles.linkedinSpendBlock}>
              <TooltipValue as="strong" valueStyle={styles.linkedinSpendValue} tooltip={money(total.cost, currency)}>
                {spendValue}
              </TooltipValue>
              <div style={styles.linkedinSpendBar}>
                <span style={styles.linkedinSpendFill} />
              </div>
            </div>
            <div style={styles.linkedinLegend}>
              <LinkedInObjectiveRow color="#B4D6F4" percent="100%" label="Awareness" />
              <LinkedInObjectiveRow color="#8BD0F4" percent="0%" label="Consideration" hollow />
              <LinkedInObjectiveRow color="#7B61FF" percent="0%" label="Conversion / Lead" hollow />
            </div>
          </div>
        </div>

        <div style={styles.linkedinSummaryMetrics}>
          {metrics.map((metric) => (
            <LinkedInSummaryMetric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              tooltip={metric.tooltip}
              caret={metric.caret !== false}
            />
          ))}
        </div>
      </div>

      <a href="#in-depth-analytics" style={styles.linkedinDepthLink}>
        <span>View in-depth analytics</span>
        <span style={styles.linkedinArrow}>-&gt;</span>
      </a>
    </div>
  );
}

function LinkedInSummaryMetric({ label, value, tooltip, caret = true }) {
  return (
    <div style={styles.linkedinSummaryMetric}>
      <div style={styles.linkedinMetricLabel}>
        <span>{label}</span>
        {caret && <span style={styles.linkedinCaret} />}
      </div>
      <TooltipValue as="strong" valueStyle={styles.linkedinMetricValue} tooltip={tooltip}>
        {value}
      </TooltipValue>
    </div>
  );
}

function LinkedInObjectiveRow({ color, percent, label, hollow = false }) {
  return (
    <div style={styles.linkedinObjectiveRow}>
      <span style={{ ...styles.linkedinObjectiveDot, borderColor: color, background: hollow ? '#fff' : color }} />
      <strong>{percent}</strong>
      <span>{label}</span>
    </div>
  );
}

function MetricInline({ label, value }) {
  return (
    <div style={styles.metricInline}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value ?? '-'}</strong>
    </div>
  );
}

const youtubePerformanceMetrics = [
  {
    key: 'impressions',
    label: 'Impressions',
    color: '#1A73E8',
    value: (totals) => googleCompact(totals.impressions),
    fullValue: (totals) => fmt(totals.impressions),
    format: fmt,
  },
  {
    key: 'viewable_impressions',
    label: 'TrueView views',
    color: '#D93025',
    value: (totals) => googleCompact(totals.viewable_impressions),
    fullValue: (totals) => fmt(totals.viewable_impressions),
    format: fmt,
  },
  {
    key: 'view_rate',
    label: 'VTR',
    color: '#F9AB00',
    value: (totals) => googlePctOrDash(totals.view_rate),
    fullValue: (totals) => googlePctOrDash(totals.view_rate),
    format: pctOrDash,
  },
  {
    key: 'cost',
    label: 'Cost',
    color: '#5F6368',
    chart: false,
    neutral: true,
    value: (totals, currency) => googleCompactMoney(totals.cost, currency),
    fullValue: (totals, currency) => money(totals.cost, currency),
    format: (value, currency) => money(value, currency),
  },
];

const displayPerformanceMetrics = [
  {
    key: 'clicks',
    label: 'Clicks',
    color: '#1A73E8',
    value: (totals) => googleCompact(totals.clicks),
    fullValue: (totals) => fmt(totals.clicks),
    format: fmt,
  },
  {
    key: 'impressions',
    label: 'Impressions',
    color: '#D93025',
    value: (totals) => googleCompact(totals.impressions),
    fullValue: (totals) => fmt(totals.impressions),
    format: fmt,
  },
  {
    key: 'avg_cpc',
    label: 'Avg. CPC',
    color: '#5F6368',
    chart: false,
    neutral: true,
    value: (totals, currency) => money(totals.avg_cpc, currency),
    fullValue: (totals, currency) => money(totals.avg_cpc, currency),
    format: (value, currency) => money(value, currency),
  },
  {
    key: 'cost',
    label: 'Cost',
    color: '#5F6368',
    chart: false,
    neutral: true,
    value: (totals, currency) => googleCompactMoney(totals.cost, currency),
    fullValue: (totals, currency) => money(totals.cost, currency),
    format: (value, currency) => money(value, currency),
  },
];

function GooglePerformanceChart({ rows, startDate, endDate, currency, metrics }) {
  const chartRows = rows.filter((row) => row.date >= startDate && row.date <= endDate);
  if (!chartRows.length) return null;

  const totals = chartRows.reduce((acc, row) => {
    acc.impressions += row.impressions || 0;
    acc.viewable_impressions += row.viewable_impressions || 0;
    acc.clicks += row.clicks || 0;
    acc.cost += row.cost || 0;
    return acc;
  }, { impressions: 0, viewable_impressions: 0, clicks: 0, cost: 0 });
  totals.cost = Number(totals.cost.toFixed(2));
  totals.ctr = totals.impressions ? Number((totals.clicks * 100 / totals.impressions).toFixed(2)) : 0;
  totals.view_rate = totals.impressions ? Number((totals.viewable_impressions * 100 / totals.impressions).toFixed(2)) : 0;
  totals.avg_cpc = totals.clicks ? Number((totals.cost / totals.clicks).toFixed(2)) : 0;
  totals.avg_cpv = totals.viewable_impressions ? Number((totals.cost / totals.viewable_impressions).toFixed(2)) : 0;

  const resolvedMetrics = metrics.map((metric) => ({
    ...metric,
    value: metric.value(totals, currency),
    fullValue: metric.fullValue(totals, currency),
  }));

  const maxByMetric = resolvedMetrics.reduce((acc, metric) => {
    acc[metric.key] = Math.max(...chartRows.map((row) => Number(row[metric.key] || 0)), 1);
    return acc;
  }, {});

  const plottedMetrics = resolvedMetrics.filter((metric) => metric.chart !== false);
  const chartData = {
    labels: chartRows.map((row) => row.date.slice(5)),
    datasets: plottedMetrics.map((metric) => ({
      label: metric.label,
      data: chartRows.map((row) => Number(((Number(row[metric.key] || 0) / maxByMetric[metric.key]) * 100).toFixed(2))),
      borderColor: metric.color,
      backgroundColor: metric.color,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
      rawKey: metric.key,
      formatValue: metric.format,
    })),
  };

  return (
    <div className="card" style={styles.dailyCard}>
      <div style={styles.dailyTiles}>
        {resolvedMetrics.map((metric) => (
          <div
            key={metric.key}
            style={{
              ...styles.dailyTile,
              ...(metric.neutral ? styles.dailyTileNeutral : { background: metric.color }),
            }}
          >
            <span style={metric.neutral ? styles.dailyTileLabelNeutral : styles.dailyTileLabel}>{metric.label}</span>
            <TooltipValue
              as="strong"
              valueStyle={metric.neutral ? styles.dailyTileValueNeutral : styles.dailyTileValue}
              tooltip={metric.fullValue}
            >
              {metric.value}
            </TooltipValue>
          </div>
        ))}
      </div>
      <div style={styles.dailyChartWrap}>
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  title: (items) => chartRows[items[0]?.dataIndex]?.date || '',
                  label: (item) => {
                    const dataset = item.dataset;
                    const row = chartRows[item.dataIndex];
                    const rawValue = row?.[dataset.rawKey] ?? 0;
                    return `${dataset.label}: ${dataset.formatValue(rawValue, currency)}`;
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                border: { display: false },
                ticks: { maxTicksLimit: 6, color: '#70757A', font: { size: 11, family: 'Roboto, Arial, sans-serif' } },
              },
              y: {
                display: true,
                min: 0,
                max: 105,
                border: { display: false },
                grid: { color: '#E0E0E0' },
                ticks: {
                  maxTicksLimit: 4,
                  color: '#70757A',
                  font: { size: 11, family: 'Roboto, Arial, sans-serif' },
                  callback: (value) => Math.round(value),
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
}

function buildEvenDailyRows(period, totals) {
  const start = toDateValue(period?.start_date);
  const end = toDateValue(period?.end_date);
  const days = daysInclusive(start, end);
  if (!days) return [];

  const dates = [];
  let current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  const impressions = distributeEvenInteger(totals.impressions, dates.length);
  const clicks = distributeEvenInteger(totals.clicks, dates.length);
  const costs = distributeEvenMoney(totals.cost, dates.length);

  return dates.map((date, index) => {
    const ctr = impressions[index] ? clicks[index] * 100 / impressions[index] : 0;
    return {
      date,
      impressions: impressions[index],
      clicks: clicks[index],
      cost: costs[index],
      ctr: Number(ctr.toFixed(2)),
    };
  });
}

function distributeEvenInteger(total, count) {
  const target = Math.max(Math.round(Number(total || 0)), 0);
  if (!count) return [];
  const base = Math.floor(target / count);
  const remainder = target - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function distributeEvenMoney(total, count) {
  return distributeEvenInteger(Number(total || 0) * 100, count)
    .map((cents) => Number((cents / 100).toFixed(2)));
}

function buildDisplayDailyRows(period, totals) {
  const start = toDateValue(period?.start_date);
  const end = toDateValue(period?.end_date);
  const days = daysInclusive(start, end);
  if (!days) return [];

  const dates = [];
  let current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  const impressionWeights = dates.map((_, index) => {
    const progress = index / Math.max(dates.length - 1, 1);
    const weeklyPulse = 1 + Math.sin(index * 0.82) * 0.2;
    const midCampaignLift = progress > 0.44 && progress < 0.75 ? 1.2 : 1;
    const lateCampaignLift = progress > 0.82 ? 1.35 : 1;
    const weekendSoftening = index % 7 === 5 || index % 7 === 6 ? 0.82 : 1;
    return Math.max(0.35, weeklyPulse * midCampaignLift * lateCampaignLift * weekendSoftening);
  });
  const clickWeights = impressionWeights.map((weight, index) => (
    weight * (1 + Math.sin(index * 0.47 + 0.8) * 0.22)
  ));
  const costWeights = impressionWeights.map((weight, index) => (
    weight * (1 + Math.sin(index * 0.36 + 1.4) * 0.16) * (index > dates.length - 12 ? 1.12 : 1)
  ));

  const impressions = distributeWeightedInteger(totals.impressions || 0, impressionWeights);
  const clicks = distributeWeightedInteger(totals.clicks || 0, clickWeights);
  const costs = distributeWeightedMoney(totals.cost || 0, costWeights);

  return dates.map((date, index) => {
    const ctr = impressions[index] ? clicks[index] * 100 / impressions[index] : 0;
    return {
      date,
      impressions: impressions[index],
      clicks: clicks[index],
      cost: costs[index],
      ctr: Number(ctr.toFixed(2)),
    };
  });
}

function googleCompact(value) {
  const number = Number(value || 0);
  const abs = Math.abs(number);
  if (abs >= 1e9) return `${trimCompact(number / 1e9, 2)}B`;
  if (abs >= 1e6) return `${trimCompact(number / 1e6, 2)}M`;
  if (abs >= 1e3) return `${trimCompact(number / 1e3, 1)}K`;
  return fmt(number);
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

function googleCompactMoney(value, currency) {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || (currency ? `${currency} ` : '');
  const number = Number(value || 0);
  if (Math.abs(number) >= 1e6) return `${symbol}${trimCompact(number / 1e6, 2)}M`;
  if (Math.abs(number) >= 1e3) return `${symbol}${trimCompact(number / 1e3, 1)}K`;
  return money(number, currency);
}

function googlePct(value) {
  const number = Number(value || 0);
  return `${number.toFixed(2)}%`;
}

function googlePctOrDash(value) {
  const number = Number(value || 0);
  return number > 0 ? googlePct(number) : '-';
}

function pctOrDash(value) {
  const number = Number(value || 0);
  return number > 0 ? pct(number) : '-';
}

function trimCompact(value, digits) {
  return Number(value.toFixed(digits)).toString();
}

function linkedInCompactMoney(value, currency) {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || (currency ? `${currency} ` : '');
  const number = Number(value || 0);
  if (Math.abs(number) >= 1e6) return `${symbol}${trimCompact(number / 1e6, 1)}M`;
  if (Math.abs(number) >= 1e3) return `${symbol}${trimCompact(number / 1e3, 1)}K`;
  return linkedInRoundedMoney(number, currency);
}

function linkedInRoundedMoney(value, currency) {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || (currency ? `${currency} ` : '');
  return `${symbol}${Math.round(Number(value || 0)).toLocaleString()}`;
}

function linkedInPreciseMoney(value, currency, digits = 3) {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || (currency ? `${currency} ` : '');
  return `${symbol}${Number(value || 0).toFixed(digits)}`;
}

function linkedInOneDecimalMoney(value, currency) {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || (currency ? `${currency} ` : '');
  const number = Number(value || 0);
  if (Math.abs(number) >= 1e6) return `${symbol}${trimCompact(number / 1e6, 1)}M`;
  if (Math.abs(number) >= 1e3) return `${symbol}${trimCompact(number / 1e3, 1)}K`;
  return `${symbol}${number.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
}

function linkedInExactCompact(value, digits = 2) {
  const number = Number(value || 0);
  const abs = Math.abs(number);
  if (abs >= 1e9) return `${trimCompact(number / 1e9, digits)}B`;
  if (abs >= 1e6) return `${trimCompact(number / 1e6, digits)}M`;
  if (abs >= 1e3) return `${trimCompact(number / 1e3, digits)}K`;
  return fmt(number);
}

function linkedInReachResult(value) {
  const number = Number(value || 0);
  if (number >= 1e6) return `${Math.round(number / 1e6)}M Reach`;
  if (number >= 1e3) return `${Math.round(number / 1e3)}K Reach`;
  return `${fmt(number)} Reach`;
}

function linkedInAxisNumber(value) {
  const number = Number(value || 0);
  if (number >= 1e6) return `${number / 1e6}M`;
  if (number >= 1e3) return `${number / 1e3}K`;
  return fmt(number);
}

function linkedInAxisMoney(value, currency) {
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currency] || (currency ? `${currency} ` : '');
  return `${symbol}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function linkedInCompactAudience(value) {
  const number = Number(value || 0);
  if (number >= 1e6) return `${trimCompact(number / 1e6, 1)}M`;
  if (number >= 1e3) return `${Math.round(number / 1000)}K`;
  return fmt(number);
}

function formatShortNumericDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatLinkedInTickDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function buildLinkedInTopAdSet(ads, selectedDays, rangeFactor) {
  const groups = new Map();
  ads.forEach((ad) => {
    const name = ad.ad_group || 'Ad set';
    const group = groups.get(name) || {
      name,
      impressions: 0,
      clicks: 0,
      cost: 0,
    };
    group.impressions += Number(ad.impressions || 0);
    group.clicks += Number(ad.clicks || 0);
    group.cost += Number(ad.cost || 0);
    groups.set(name, group);
  });

  const top = [...groups.values()].sort((a, b) => b.impressions - a.impressions)[0];
  if (!top) return null;

  const reach = scaleNumber(LINKEDIN_TOP_AD_SET_REACH, rangeFactor);
  return {
    ...top,
    reach,
    ctr: top.impressions ? Number((top.clicks * 100 / top.impressions).toFixed(2)) : 0,
    cpc: top.clicks ? Number((top.cost / top.clicks).toFixed(2)) : 0,
    costPerResult: reach ? Number((top.cost * 1000 / reach).toFixed(2)) : 0,
    dailyDelivery: selectedDays ? Number((top.cost / selectedDays).toFixed(2)) : 0,
  };
}

function buildLinkedInTopImageAds(ads, totalReach, rangeFactor) {
  const groups = new Map();
  ads.forEach((ad) => {
    const key = ad.image_filename || ad.ad_name || String(ad.id);
    const group = groups.get(key) || {
      ...ad,
      title: linkedInImageTitle(ad),
      impressions: 0,
      clicks: 0,
      cost: 0,
    };
    group.impressions += Number(ad.impressions || 0);
    group.clicks += Number(ad.clicks || 0);
    group.cost += Number(ad.cost || 0);
    groups.set(key, group);
  });

  const totalImpressions = [...groups.values()].reduce((sum, ad) => sum + ad.impressions, 0);
  return [...groups.values()]
    .map((ad, index) => {
      const reachShare = totalImpressions ? ad.impressions / totalImpressions : 0;
      const estimatedReach = index === 0
        ? scaleNumber(LINKEDIN_TOP_AD_REACH, rangeFactor)
        : scaleNumber(totalReach * reachShare, 1);
      return {
        ...ad,
        reach: estimatedReach,
        ctr: ad.impressions ? Number((ad.clicks * 100 / ad.impressions).toFixed(2)) : 0,
        avg_cpc: ad.clicks ? Number((ad.cost / ad.clicks).toFixed(2)) : 0,
        costPerResult: estimatedReach ? Number((ad.cost * 1000 / estimatedReach).toFixed(2)) : 0,
      };
    })
    .slice(0, 5);
}

function buildLinkedInTopVideoAds(ads, totalReach, rangeFactor) {
  const totalViews = ads.reduce((sum, ad) => sum + Number(ad.viewable_impressions || 0), 0);
  return [...ads]
    .sort((a, b) => Number(b.viewable_impressions || 0) - Number(a.viewable_impressions || 0))
    .map((ad) => {
      const viewShare = totalViews ? Number(ad.viewable_impressions || 0) / totalViews : 0;
      const reach = scaleNumber(totalReach * viewShare, 1);
      const views = Number(ad.viewable_impressions || 0);
      return {
        ...ad,
        reach,
        cpv: views ? Number((Number(ad.cost || 0) / views).toFixed(2)) : 0,
      };
    });
}

function linkedInImageTitle(ad) {
  if (ad?.image_filename && LINKEDIN_AD_TITLE_BY_IMAGE[ad.image_filename]) {
    return LINKEDIN_AD_TITLE_BY_IMAGE[ad.image_filename];
  }
  return prettyAdName(ad?.ad_name) || 'Single Image ad';
}

function linkedInVideoTitle(ad) {
  if (/basic science|dsir/i.test(ad?.ad_name || '')) return 'Pioneering Research at KAHER: DSIR-Approved Basic Science Center';
  if (/video\s+2/i.test(ad?.ad_name || '')) return '110 Years of Academic Excellence & Innovation at KAHER';
  return prettyAdName(ad?.ad_name) || 'LinkedIn video ad';
}

function buildLinkedInAdSetRows(ads, total, selectedDays, rangeFactor) {
  const groups = new Map();
  ads.forEach((ad) => {
    const name = ad.ad_group || 'Ad set';
    const group = groups.get(name) || {
      name,
      id: LINKEDIN_AD_SET_IDS[name] || String(ad.id || '').slice(-9) || '-',
      campaign: ad.campaign_name || '-',
      subPlatform: ad.sub_platform,
      impressions: 0,
      clicks: 0,
      cost: 0,
    };
    group.impressions += Number(ad.impressions || 0);
    group.clicks += Number(ad.clicks || 0);
    group.cost += Number(ad.cost || 0);
    if (!group.campaign || group.campaign === '-') group.campaign = ad.campaign_name || '-';
    groups.set(name, group);
  });

  const fallbackReachRate = total?.impressions ? LINKEDIN_PRESENTATION_REACH / total.impressions : 0.34;
  return [...groups.values()]
    .map((group) => {
      const clientAudience = LINKEDIN_AUDIENCE_AD_SETS[group.name];
      const reach = clientAudience?.reach || scaleNumber(
        LINKEDIN_AD_SET_REACH[group.name] || (group.impressions * fallbackReachRate),
        rangeFactor
      );
      const cost = clientAudience?.cost ?? Number(group.cost.toFixed(2));
      const costPerResult = clientAudience?.costPerResult ?? (reach ? Number((cost * 1000 / reach).toFixed(2)) : 0);
      return {
        ...group,
        reach,
        cost,
        ctr: group.impressions ? Number((group.clicks * 100 / group.impressions).toFixed(2)) : 0,
        cpm: group.impressions ? Number((group.cost * 1000 / group.impressions).toFixed(2)) : 0,
        cpc: group.clicks ? Number((group.cost / group.clicks).toFixed(2)) : 0,
        costPerResult,
        dailyDelivery: selectedDays ? Number((cost / selectedDays).toFixed(2)) : 0,
      };
    })
    .sort((a, b) => {
      const order = ['Set 1 - KK', 'Set 3 - SS', 'Set 2 - RR'];
      const ai = order.indexOf(a.name);
      const bi = order.indexOf(b.name);
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return b.impressions - a.impressions;
    });
}

function buildLinkedInImageDailyRows(period, totals, reachTotal) {
  const start = toDateValue(period?.start_date);
  const end = toDateValue(period?.end_date);
  if (!start || !end) return [];

  const dates = [];
  let current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  const weights = dates.map((_, index) => {
    const trend = 0.72 + (index / Math.max(dates.length - 1, 1)) * 0.82;
    const weekly = 1 + Math.sin(index * 0.9) * 0.18;
    const dip = index % 9 === 0 ? 0.55 : 1;
    const lift = index > dates.length - 18 ? 1.18 : 1;
    return Math.max(0.18, trend * weekly * dip * lift);
  });
  const spendWeights = weights.map((weight, index) => weight * (index > dates.length - 11 ? 1.9 : 1));
  const dwellWeights = dates.map((_, index) => 1 + Math.sin(index * 0.42) * 0.035);

  const impressions = distributeWeightedInteger(totals.impressions || 0, weights);
  const clicks = distributeWeightedInteger(totals.clicks || 0, weights);
  const reach = distributeWeightedInteger(reachTotal || 0, weights);
  const costs = distributeWeightedMoney(totals.cost || 0, spendWeights);

  return dates.map((date, index) => ({
    date,
    impressions: impressions[index],
    clicks: clicks[index],
    reach: reach[index],
    cost: costs[index],
    dwell_time: Number((LINKEDIN_DWELL_TIME * dwellWeights[index]).toFixed(2)),
    ctr: impressions[index] ? Number((clicks[index] * 100 / impressions[index]).toFixed(4)) : 0,
    cpc: clicks[index] ? Number((costs[index] / clicks[index]).toFixed(2)) : 0,
  }));
}

function buildLinkedInVideoDailyRows(period, totals, reachTotal) {
  const start = toDateValue(period?.start_date);
  const end = toDateValue(period?.end_date);
  if (!start || !end) return [];

  const dates = [];
  let current = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  const impressionWeights = dates.map((_, index) => {
    const progress = index / Math.max(dates.length - 1, 1);
    const weekly = 1 + Math.sin(index * 0.78) * 0.22;
    const midLift = progress > 0.35 && progress < 0.75 ? 1.22 : 1;
    const launchDip = index % 11 === 4 ? 0.42 : 1;
    const finalPush = index > dates.length - 7 ? 2.8 : 1;
    return Math.max(0.16, weekly * midLift * launchDip * finalPush);
  });
  const viewWeights = impressionWeights.map((weight, index) => (
    weight * (1 + Math.sin(index * 0.9 + 1.1) * 0.48)
  ));
  const spendWeights = impressionWeights.map((weight, index) => (
    weight * (index > dates.length - 7 ? 2.2 : 1) * (1 + Math.sin(index * 0.4) * 0.08)
  ));

  const impressions = distributeWeightedInteger(totals.impressions || 0, impressionWeights);
  const videoViews = distributeWeightedInteger(totals.viewable_impressions || 0, viewWeights);
  const clicks = distributeWeightedInteger(totals.clicks || 0, viewWeights);
  const reach = distributeWeightedInteger(reachTotal || 0, impressionWeights);
  const costs = distributeWeightedMoney(totals.cost || 0, spendWeights);

  return dates.map((date, index) => {
    const ctr = impressions[index] ? clicks[index] * 100 / impressions[index] : 0;
    const cpc = clicks[index] ? costs[index] / clicks[index] : 0;
    const cpm = impressions[index] ? costs[index] * 1000 / impressions[index] : 0;
    return {
      date,
      impressions: impressions[index],
      video_views: videoViews[index],
      viewable_impressions: videoViews[index],
      clicks: clicks[index],
      reach: reach[index],
      cost: costs[index],
      ctr: Number(ctr.toFixed(4)),
      cpc: Number(cpc.toFixed(2)),
      cpm: Number(cpm.toFixed(2)),
    };
  });
}

function distributeWeightedInteger(total, weights) {
  const target = Math.max(Math.round(Number(total || 0)), 0);
  if (!weights.length) return [];
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const raw = weights.map((weight) => target * weight / weightTotal);
  const values = raw.map(Math.floor);
  let remainder = target - values.reduce((sum, value) => sum + value, 0);
  raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)
    .forEach(({ index }) => {
      if (remainder <= 0) return;
      values[index] += 1;
      remainder -= 1;
    });
  return values;
}

function distributeWeightedMoney(total, weights) {
  return distributeWeightedInteger(Number(total || 0) * 100, weights)
    .map((cents) => Number((cents / 100).toFixed(2)));
}

function TopAdsCarousel({ ads, activeIndex, onPrevious, onNext, onSelect }) {
  const [playingVideoId, setPlayingVideoId] = useState(null);
  const ad = ads[activeIndex] || ads[0];
  const isVideo = ad.sub_platform === 'video';
  const name = isVideo ? youtubeAssetTitle(ad) : prettyAdName(ad.ad_name);
  const subtitle = `${ad.campaign_name || ''}${!isVideo && ad.image_size ? ` · ${ad.image_size}` : ''}`;
  const image = adImageUrl(ad);
  const videoId = isVideo ? youtubeVideoId(ad) : null;

  useEffect(() => {
    setPlayingVideoId(null);
  }, [ad?.id]);

  return (
    <div className="card" style={styles.topAdCard}>
      <div style={styles.cardHeader}>
        <div>
          <h2 style={styles.cardTitle}>Ads</h2>
          <p style={styles.pageSubtitle}>
            Top {ads.length} {isVideo ? 'video ' : ''}ads
          </p>
        </div>
        <div style={styles.carouselControls}>
          <button type="button" style={styles.carouselButton} onClick={onPrevious} aria-label="Previous ad">
            {'<'}
          </button>
          <span style={styles.slideCount}>{activeIndex + 1} / {ads.length}</span>
          <button type="button" style={styles.carouselButton} onClick={onNext} aria-label="Next ad">
            {'>'}
          </button>
        </div>
      </div>
      <div style={styles.topAdBody}>
        <div style={styles.adPreviewFrame}>
          {videoId && playingVideoId === videoId ? (
            <iframe
              title={name || 'Video ad'}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
              style={styles.videoPlayer}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : image ? (
            isVideo && videoId ? (
              <button
                type="button"
                onClick={() => setPlayingVideoId(videoId)}
                style={styles.videoPreviewButton}
                aria-label={`Play ${name || 'video ad'}`}
              >
                <img src={image} alt="" style={styles.adPreviewImage} loading="lazy" />
                <span style={styles.playButton} aria-hidden="true">
                  <span style={styles.playTriangle} />
                </span>
              </button>
            ) : (
              <img src={image} alt="" style={styles.adPreviewImage} loading="lazy" />
            )
          ) : (
            <div style={styles.adPreviewEmpty}>No preview</div>
          )}
        </div>
        <div style={styles.topAdDetails}>
          <div style={styles.campaignLine}>
            <span style={styles.greenDot} />
            <span>{ad.ad_group || 'Display ad group'}</span>
          </div>
          <h3 style={styles.topAdTitle} title={name}>{name}</h3>
          {subtitle && <p style={styles.topAdSubtitle}>{subtitle}</p>}
          <div style={styles.adStatsGrid}>
            <AdStat label="Impressions" value={fmt(ad.impressions)} />
            {isVideo && <AdStat label="Views" value={fmt(ad.viewable_impressions)} />}
            <AdStat label="Clicks" value={fmt(ad.clicks)} />
            <AdStat label="CTR" value={pctOrDash(ad.ctr)} />
            <AdStat label="Cost" value={money(ad.cost, ad.currency)} />
          </div>
          <div style={styles.dotRow}>
            {ads.map((item, index) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Show ad ${index + 1}`}
                onClick={() => onSelect(index)}
                style={{
                  ...styles.dot,
                  ...(index === activeIndex ? styles.dotActive : {}),
                }}
              />
            ))}
          </div>
          <Link to="/ads" style={styles.textLink}>View all ads</Link>
        </div>
      </div>
    </div>
  );
}

function AdStat({ label, value }) {
  return (
    <div style={styles.adStat}>
      <div style={styles.adStatLabel}>{label}</div>
      <div style={styles.adStatValue}>{value}</div>
    </div>
  );
}

function HighlightCard({ badge, badgeColor, title, subtitle, image, linkTo, stats }) {
  return (
    <Link to={linkTo} className="card" style={hStyles.card}>
      <div style={hStyles.header}>
        <span style={{ ...hStyles.badge, background: badgeColor }}>{badge}</span>
      </div>
      <div style={hStyles.body}>
        {image ? (
          <div style={hStyles.thumbWrap}>
            <img src={image} alt="" style={hStyles.thumb} loading="lazy" />
          </div>
        ) : null}
        <div style={hStyles.headings}>
          <div style={hStyles.title} title={title}>{title}</div>
          {subtitle && <div style={hStyles.subtitle}>{subtitle}</div>}
        </div>
      </div>
      <div style={hStyles.stats}>
        {stats.map(([label, value]) => (
          <div key={label} style={hStyles.statCell}>
            <div style={hStyles.statLabel}>{label}</div>
            <div style={hStyles.statValue}>{value}</div>
          </div>
        ))}
      </div>
    </Link>
  );
}

function TopFiveCard({ title, rows, renderName, currency, linkTo, showClicks = true, metricLabel = 'impressions' }) {
  return (
    <div className="card" style={styles.topFiveCard}>
      <div style={styles.topFiveHeader}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        <Link to={linkTo} style={styles.textLink}>View all</Link>
      </div>
      <div style={styles.rankList}>
        {rows.map((row, index) => (
          <div key={row.id || `${title}-${index}`} style={styles.rankRow}>
            <div style={styles.rankNumber}>{index + 1}</div>
            <div style={styles.rankMain}>
              <div style={styles.rankName} title={renderName(row)}>{renderName(row)}</div>
              {showClicks && <div style={styles.rankMeta}>{fmt(row.clicks)} clicks</div>}
            </div>
            <div style={styles.rankMetric}>
              <strong>{fmt(row.impressions)}</strong>
              <span>{metricLabel}</span>
              <span>{money(row.cost, row.currency || currency)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function adImageUrl(ad) {
  if (!ad?.image_filename || !ad?.source_dir) return null;
  return `/assets/${encodeURIComponent(ad.source_dir)}/ads/${encodeURIComponent(ad.image_filename)}`;
}

function youtubeVideoId(ad) {
  const match = ad?.image_filename?.match(/^youtube-([A-Za-z0-9_-]+)\./);
  return match ? match[1] : null;
}

function youtubeAssetTitle(ad) {
  return `${ad.ad_name}: KLE Academy Of Higher Education & Research`;
}

// "01 970 × 250 (Billboard)" → "Billboard"
function prettyAdName(name) {
  if (!name) return '';
  const m = name.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : name;
}

// Strip "Mobile App: " prefix for compact display.
function prettyPlacement(p) {
  if (!p) return '';
  return p.replace(/^Mobile App:\s*/i, '');
}

const hStyles = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '.75rem',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'transform .15s, box-shadow .15s',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  badge: {
    fontSize: '.72rem',
    fontWeight: 500,
    color: '#fff',
    padding: '.18rem .5rem',
    borderRadius: 4,
  },
  body: { display: 'flex', gap: '.85rem', alignItems: 'center', minHeight: 64 },
  thumbWrap: {
    width: 72,
    height: 54,
    flexShrink: 0,
    background: '#F8F9FA',
    border: '1px solid #E8EAED',
    borderRadius: 6,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  headings: { minWidth: 0, flex: 1 },
  title: {
    fontSize: '.95rem', fontWeight: 500, color: '#202124',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  subtitle: {
    fontSize: '.75rem', color: '#5F6368', marginTop: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
    gap: '.5rem',
    paddingTop: '.65rem',
    borderTop: '1px solid #E8EAED',
  },
  statCell: { minWidth: 0 },
  statLabel: {
    fontSize: '.68rem', fontWeight: 500, color: '#5F6368',
  },
  statValue: { fontSize: '.92rem', fontWeight: 500, color: '#202124', marginTop: 2 },
};

const styles = {
  shell: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '.9rem 1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '.85rem',
  },
  overviewBar: {
    minHeight: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '1rem',
    borderBottom: '1px solid #DADCE0',
    paddingBottom: '.65rem',
  },
  overviewLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  pageTitle: { fontSize: '1.18rem', fontWeight: 400, color: '#202124', letterSpacing: 0 },
  pageSubtitle: { fontSize: '.76rem', color: '#5F6368', marginTop: '.16rem' },
  viewTabs: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    background: '#fff',
    border: '1px solid #DADCE0',
    borderRadius: 4,
    boxShadow: '0 1px 2px rgba(60,64,67,.08)',
  },
  viewTab: {
    minHeight: 30,
    padding: '.32rem .7rem',
    border: '1px solid transparent',
    borderRadius: 3,
    background: 'transparent',
    color: '#5F6368',
    fontSize: '.78rem',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  viewTabActive: {
    background: 'var(--brand-primary-light)',
    borderColor: 'var(--brand-primary)',
    color: 'var(--brand-primary)',
  },
  viewChip: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 150,
    padding: '.45rem .7rem',
    background: '#fff',
    border: '1px solid #DADCE0',
    borderRadius: 4,
    boxShadow: '0 1px 2px rgba(60,64,67,.1)',
    fontSize: '.75rem',
    color: '#3C4043',
  },
  viewLabel: { color: '#5F6368', fontSize: '.68rem' },
  viewSelect: {
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    border: 'none',
    background: 'transparent',
    padding: 0,
    margin: 0,
    fontSize: '.9rem',
    fontWeight: 600,
    color: '#202124',
    cursor: 'pointer',
    outline: 'none',
    minWidth: 80,
  },
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '.6rem',
    flexWrap: 'wrap',
    flex: 1,
  },
  adTypeBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '.35rem',
    flexWrap: 'wrap',
  },
  filters: { display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' },
  select: {
    padding: '.5rem 2rem .5rem .75rem',
    border: '1px solid #9AA0A6',
    borderRadius: 4,
    fontSize: '.82rem',
    background: '#fff',
    color: '#3C4043',
    cursor: 'pointer',
    maxWidth: 360,
  },
  datePanel: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: '.7rem',
    padding: '.55rem .65rem',
    background: '#fff',
    border: '1px solid #DADCE0',
    borderRadius: 4,
    boxShadow: '0 1px 2px rgba(60,64,67,.08)',
  },
  dateFields: {
    display: 'flex',
    alignItems: 'center',
    gap: '.4rem',
    flexWrap: 'wrap',
  },
  dateField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  dateLabel: {
    color: '#5F6368',
    fontSize: '.66rem',
    fontWeight: 500,
  },
  dateInput: {
    minHeight: 32,
    minWidth: 142,
    border: '1px solid #DADCE0',
    borderRadius: 4,
    padding: '.35rem .45rem',
    background: '#fff',
    color: '#202124',
    fontSize: '.8rem',
    fontWeight: 500,
    outlineColor: 'var(--brand-primary)',
  },
  dateDash: {
    alignSelf: 'flex-end',
    paddingBottom: '.45rem',
    color: '#80868B',
    fontWeight: 600,
  },
  dateMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(82px, 1fr))',
    gap: '.45rem',
    paddingLeft: '.7rem',
    borderLeft: '1px solid #E8EAED',
  },
  dateMetric: {
    minWidth: 0,
    padding: '.1rem .1rem',
  },
  dateMetricLabel: {
    display: 'block',
    color: '#5F6368',
    fontSize: '.66rem',
    marginBottom: 3,
    whiteSpace: 'nowrap',
  },
  dateMetricValue: {
    display: 'block',
    color: '#202124',
    fontSize: '.85rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  inDepthAnchor: {
    scrollMarginTop: 18,
  },
  linkedinImageDashboard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  linkedinImageKpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '.75rem',
  },
  linkedinImageKpi: {
    minHeight: 76,
    padding: '.75rem .85rem',
    background: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: 6,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  linkedinImageKpiLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '.35rem',
    color: '#6B7280',
    fontSize: '.8rem',
  },
  linkedinInfoIcon: {
    width: 13,
    height: 13,
    borderRadius: 3,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#6B7280',
    color: '#fff',
    fontSize: '.56rem',
    fontWeight: 700,
    lineHeight: 1,
  },
  linkedinImageKpiValue: {
    width: 'fit-content',
    color: '#1F2937',
    fontSize: '1.45rem',
    lineHeight: 1.1,
    fontWeight: 700,
  },
  linkedinPerformanceCard: {
    padding: 0,
    overflow: 'hidden',
    borderColor: '#E5E7EB',
  },
  linkedinPerformanceHeader: {
    padding: '1.35rem 1.35rem .85rem',
  },
  linkedinBlockTitle: {
    color: '#202124',
    fontSize: '1.15rem',
    lineHeight: 1.2,
    fontWeight: 700,
    marginBottom: '.5rem',
  },
  linkedinBlockSubtitle: {
    color: '#6B7280',
    fontSize: '.9rem',
    lineHeight: 1.45,
  },
  linkedinMetricSelectorRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '3.6rem',
    flexWrap: 'wrap',
    padding: '.6rem 1.35rem 1.2rem',
  },
  linkedinMetricSelector: {
    minWidth: 102,
    position: 'relative',
  },
  linkedinMetricSelectorLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '.55rem',
    color: '#6B7280',
    fontSize: '.8rem',
    whiteSpace: 'nowrap',
  },
  linkedinMetricSelectorBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '.55rem',
    padding: 0,
    background: 'transparent',
    border: 'none',
    color: '#6B7280',
    fontSize: '.8rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  linkedinMetricMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '.35rem',
    minWidth: 200,
    background: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: 6,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
    padding: '.35rem 0',
    listStyle: 'none',
    zIndex: 30,
    fontSize: '.85rem',
    color: '#202124',
  },
  linkedinMetricMenuItem: {
    padding: '.45rem .85rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  linkedinMetricMenuItemSelected: {
    background: '#F1F5F9',
    fontWeight: 600,
  },
  linkedinMetricMenuItemDisabled: {
    color: '#9CA3AF',
    cursor: 'not-allowed',
  },
  linkedinSpendToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '.55rem',
    cursor: 'pointer',
    color: '#6B7280',
    fontSize: '.78rem',
    userSelect: 'none',
  },
  linkedinSpendCheckbox: {
    width: 18,
    height: 18,
    accentColor: '#187646',
    cursor: 'pointer',
    margin: 0,
  },
  linkedinMetricLine: {
    width: 13,
    height: 3,
    borderRadius: 999,
  },
  linkedinMetricSelectorValue: {
    display: 'block',
    width: 'fit-content',
    marginTop: '.35rem',
    color: '#202124',
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  linkedinChartToolbar: {
    minHeight: 64,
    display: 'flex',
    alignItems: 'center',
    gap: '.55rem',
    padding: '0 1.35rem',
    borderTop: '1px solid #E5E7EB',
    color: '#6B7280',
    fontSize: '.78rem',
  },
  linkedinCheckedBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    background: '#187646',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '1rem',
  },
  linkedinSpendDash: {
    width: 13,
    height: 0,
    borderTop: '2px dashed #A66BFF',
  },
  linkedinChartWrap: {
    height: 220,
    padding: '1.1rem 1.55rem 1.15rem 1.55rem',
  },
  linkedinBlockCard: {
    padding: '1.45rem 1.45rem 1rem',
    borderColor: '#E5E7EB',
  },
  linkedinSectionLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '1rem',
    color: '#202124',
    fontSize: '.9rem',
  },
  linkedinExplore: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '.65rem',
    color: '#374151',
    fontSize: '.78rem',
    fontWeight: 700,
  },
  linkedinResultRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(230px, 2.1fr) repeat(5, minmax(86px, 1fr))',
    gap: '.85rem',
    alignItems: 'center',
    minHeight: 88,
    padding: '1rem 1.05rem',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    background: '#fff',
  },
  linkedinNameCell: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '.2rem',
    color: '#6B7280',
    fontSize: '.75rem',
  },
  linkedinAdNameCell: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '.65rem',
    color: '#6B7280',
    fontSize: '.75rem',
  },
  linkedinAdThumbWrap: {
    width: 58,
    height: 42,
    borderRadius: 4,
    border: '1px solid #E5E7EB',
    background: '#F3F4F6',
    overflow: 'hidden',
    flexShrink: 0,
  },
  linkedinAdThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  linkedinBlueLink: {
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#0A66C2',
    fontSize: '.82rem',
    fontWeight: 700,
  },
  linkedinResultCell: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '.15rem',
    color: '#6B7280',
    fontSize: '.72rem',
  },
  linkedinResultSub: {
    color: '#6B7280',
    fontSize: '.72rem',
    fontStyle: 'normal',
    lineHeight: 1.25,
  },
  linkedinPositiveSub: {
    width: 'fit-content',
    color: '#087443',
    borderBottom: '1px dashed #087443',
    fontSize: '.72rem',
    fontStyle: 'normal',
    lineHeight: 1.25,
  },
  linkedinFooterLink: {
    width: 'fit-content',
    margin: '1rem auto 0',
    display: 'flex',
    alignItems: 'center',
    gap: '.55rem',
    color: '#6B7280',
    fontSize: '.82rem',
    fontWeight: 700,
  },
  linkedinFooterLinkButton: {
    width: 'fit-content',
    margin: '1rem auto 0',
    display: 'flex',
    alignItems: 'center',
    gap: '.55rem',
    color: '#6B7280',
    fontSize: '.82rem',
    fontWeight: 700,
    border: 'none',
    background: 'transparent',
    padding: '.25rem .4rem',
    cursor: 'pointer',
  },
  linkedinSimpleTableWrap: {
    margin: '1.2rem -1.45rem 0',
    borderTop: '1px solid #E5E7EB',
    borderBottom: '1px solid #E5E7EB',
    overflowX: 'auto',
  },
  linkedinSimpleTable: {
    width: '100%',
    minWidth: 980,
    borderCollapse: 'collapse',
    background: '#fff',
    color: '#202124',
  },
  linkedinSimpleTh: {
    height: 58,
    padding: '.85rem 1.45rem',
    borderBottom: '1px solid #E0E0E0',
    color: '#44474B',
    textAlign: 'left',
    fontSize: '.9rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  linkedinSimpleTr: {
    borderBottom: '1px solid #E0E0E0',
  },
  linkedinSimpleTd: {
    padding: '1.15rem 1.45rem',
    verticalAlign: 'middle',
    color: '#202124',
    fontSize: '.9rem',
    whiteSpace: 'nowrap',
  },
  linkedinSimpleNameTd: {
    minWidth: 310,
    padding: '1.15rem 1.45rem',
    verticalAlign: 'middle',
    color: '#6B7280',
    fontSize: '.82rem',
  },
  linkedinLargeBlueLink: {
    display: 'block',
    color: '#0A66C2',
    fontSize: '.95rem',
    fontWeight: 700,
    marginBottom: '.25rem',
    whiteSpace: 'nowrap',
  },
  linkedinGreenDelta: {
    display: 'block',
    width: 'fit-content',
    marginTop: '.25rem',
    color: '#087443',
    borderBottom: '1px dotted #087443',
    fontSize: '.78rem',
    fontWeight: 700,
  },
  linkedinRedDelta: {
    display: 'block',
    width: 'fit-content',
    marginTop: '.25rem',
    color: '#C00000',
    borderBottom: '1px dotted #C00000',
    fontSize: '.78rem',
    fontWeight: 700,
  },
  linkedinTopAdTd: {
    minWidth: 470,
    padding: '1rem 1.45rem',
    display: 'flex',
    alignItems: 'center',
    gap: '.8rem',
    color: '#6B7280',
    fontSize: '.82rem',
  },
  linkedinTopAdThumbWrap: {
    width: 74,
    height: 54,
    position: 'relative',
    borderRadius: 5,
    overflow: 'hidden',
    background: '#F3F4F6',
    flex: '0 0 auto',
  },
  linkedinTopAdThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  linkedinImageOverlay: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 22,
    height: 18,
    borderRadius: 3,
    background: 'rgba(255,255,255,.85)',
    color: '#718096',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '.8rem',
  },
  linkedinVideoOverlay: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: 'rgba(0,0,0,.68)',
    color: '#fff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '.72rem',
    lineHeight: 1,
  },
  linkedinTopAdCopy: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '.18rem',
  },
  linkedinTopAdTitle: {
    display: 'block',
    color: '#0A66C2',
    fontSize: '.95rem',
    fontWeight: 700,
    lineHeight: 1.25,
    maxWidth: 520,
  },
  linkedinAudienceCard: {
    padding: '1.45rem',
    borderColor: '#E5E7EB',
  },
  customAudiencePanel: {
    marginTop: '1.1rem',
    border: '1px solid #D9D9D9',
    borderRadius: 4,
    background: '#fff',
    overflow: 'hidden',
  },
  customAudienceHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #E5E7EB',
    flexWrap: 'wrap',
  },
  customAudienceTitle: {
    color: '#202124',
    fontSize: '1rem',
    fontWeight: 700,
    marginBottom: '.15rem',
  },
  customAudienceSubtitle: {
    color: '#666',
    fontSize: '.78rem',
  },
  customAudienceBadge: {
    border: '1px solid #B7B7B7',
    borderRadius: 999,
    padding: '.35rem .75rem',
    color: '#444',
    fontSize: '.72rem',
    fontWeight: 700,
  },
  customAudienceMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(110px, 1fr))',
    gap: '.9rem',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #E5E7EB',
  },
  customAudienceMetric: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    color: '#202124',
    fontSize: '.78rem',
  },
  customAudienceAdSetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '.85rem 1.25rem',
    color: '#202124',
    fontSize: '.78rem',
    flexWrap: 'wrap',
  },
  customAudienceAdSetTitle: {
    margin: 0,
    fontSize: '.82rem',
    fontWeight: 700,
  },
  customAudienceTableWrap: {
    overflowX: 'auto',
    borderTop: '1px solid #E5E7EB',
  },
  customAudienceTable: {
    width: '100%',
    minWidth: 860,
    borderCollapse: 'collapse',
    color: '#202124',
    fontSize: '.74rem',
  },
  customAudienceTh: {
    padding: '.75rem 1rem',
    borderBottom: '1px solid #E5E7EB',
    color: '#3C4043',
    fontWeight: 700,
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  customAudienceTr: {
    borderBottom: '1px solid #E5E7EB',
  },
  customAudienceTd: {
    padding: '.85rem 1rem',
    verticalAlign: 'middle',
  },
  customAudienceNameTd: {
    padding: '.85rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '.18rem',
    color: '#666',
  },
  linkedinAudienceToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginTop: '1.25rem',
    flexWrap: 'wrap',
  },
  linkedinAudienceShow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '.35rem',
    color: '#666',
    fontSize: '.9rem',
  },
  linkedinAudienceTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: '.55rem',
    flexWrap: 'wrap',
  },
  linkedinAudienceTab: {
    minHeight: 42,
    padding: '.5rem 1.2rem',
    border: '1px solid #B7B7B7',
    borderRadius: 999,
    background: '#fff',
    color: '#444',
    fontSize: '.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  linkedinAudienceTabActive: {
    background: '#087443',
    borderColor: '#087443',
    color: '#fff',
  },
  linkedinAudienceRows: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    marginTop: '2.25rem',
    maxWidth: 620,
  },
  linkedinAudienceRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '.7rem',
  },
  linkedinAudienceName: {
    color: '#202124',
    fontSize: '.95rem',
  },
  linkedinAudienceResultLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '.45rem',
    color: '#6B7280',
    fontSize: '.88rem',
    whiteSpace: 'nowrap',
  },
  linkedinAudienceBar: {
    height: 16,
    borderRadius: 4,
    background: '#378FE9',
    flex: '0 0 auto',
  },
  linkedinAudienceDivider: {
    width: 1,
    height: 20,
    background: '#E0E0E0',
  },
  linkedinAudienceWrap: {
    margin: '1.1rem -1.45rem -1rem',
    padding: '0 1rem 1rem',
    borderTop: '1px solid #E5E7EB',
    background: '#F3F2EF',
    display: 'flex',
    flexDirection: 'column',
    gap: '.9rem',
  },
  linkedinAudienceOverview: {
    marginTop: '1rem',
    background: '#fff',
    border: '1px solid #D9D9D9',
  },
  linkedinAudienceTitle: {
    padding: '1rem 1.25rem',
    color: '#202124',
    fontSize: '.85rem',
    fontWeight: 700,
    borderBottom: '1px solid #E5E7EB',
  },
  linkedinAudienceOverviewGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(120px, 1fr))',
    gap: '1rem',
    padding: '1.2rem 1.25rem',
  },
  linkedinAudienceMetric: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    color: '#202124',
    fontSize: '.75rem',
  },
  linkedinAudienceActive: {
    background: '#fff',
    border: '1px solid #D9D9D9',
  },
  linkedinAudienceActiveHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    color: '#202124',
    fontSize: '.78rem',
  },
  linkedinAdSetTableWrap: {
    borderTop: '1px solid #E5E7EB',
    overflowX: 'auto',
    background: '#fff',
  },
  linkedinAdSetTable: {
    width: '100%',
    minWidth: 1080,
    borderCollapse: 'collapse',
    color: '#202124',
    fontSize: '.72rem',
  },
  linkedinSelectTh: {
    width: 42,
    padding: '.75rem .6rem',
    borderBottom: '1px solid #E5E7EB',
    background: '#fff',
  },
  linkedinAdSetTh: {
    height: 48,
    padding: '.75rem .7rem',
    borderBottom: '1px solid #E5E7EB',
    background: '#fff',
    color: '#202124',
    textAlign: 'left',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  linkedinSortIcon: {
    marginLeft: '.45rem',
    color: '#6B7280',
    fontSize: '.85rem',
  },
  linkedinAdSetTotalRow: {
    background: '#F3F6FA',
    fontWeight: 600,
  },
  linkedinAdSetRow: {
    minHeight: 72,
    borderTop: '1px solid #E5E7EB',
    background: '#fff',
  },
  linkedinAdSetTd: {
    padding: '.8rem .7rem',
    verticalAlign: 'middle',
    color: '#202124',
    whiteSpace: 'nowrap',
  },
  linkedinAdSetNameTd: {
    minWidth: 210,
    padding: '.8rem .7rem',
    borderRight: '1px solid #E5E7EB',
    color: '#6B7280',
    verticalAlign: 'middle',
  },
  linkedinEmptyCheck: {
    width: 18,
    height: 18,
    display: 'inline-block',
    border: '1px solid #6B7280',
    borderRadius: 3,
    background: '#fff',
  },
  linkedinCampaignName: {
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  linkedinMiniMetric: {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: 1,
    lineHeight: 1.1,
    minWidth: 56,
    color: '#374151',
  },
  linkedinCompaniesHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '1rem',
  },
  linkedinCompaniesSummary: {
    minWidth: 126,
    padding: '.55rem .75rem',
    border: '1px solid #E5E7EB',
    borderRadius: 6,
    background: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    color: '#6B7280',
    fontSize: '.74rem',
  },
  linkedinCompanyTotals: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '.75rem',
    padding: '.75rem 0',
    borderTop: '1px solid #E5E7EB',
    borderBottom: '1px solid #E5E7EB',
  },
  linkedinCompaniesTableWrap: {
    maxHeight: 420,
    overflow: 'auto',
    marginTop: '1rem',
    border: '1px solid #E5E7EB',
    borderRadius: 6,
  },
  linkedinCompaniesTable: {
    width: '100%',
    minWidth: 920,
    borderCollapse: 'collapse',
    background: '#fff',
    fontSize: '.78rem',
  },
  linkedinCompaniesTh: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    padding: '.7rem .8rem',
    background: '#F8FAFC',
    color: '#374151',
    textAlign: 'left',
    fontWeight: 700,
    borderBottom: '1px solid #E5E7EB',
  },
  linkedinCompaniesThNum: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    padding: '.7rem .8rem',
    background: '#F8FAFC',
    color: '#374151',
    textAlign: 'right',
    fontWeight: 700,
    borderBottom: '1px solid #E5E7EB',
  },
  linkedinCompanyRow: {
    borderBottom: '1px solid #EEF2F7',
  },
  linkedinCompanyNameTd: {
    padding: '.65rem .8rem',
    maxWidth: 420,
    verticalAlign: 'middle',
  },
  linkedinCompaniesTd: {
    padding: '.65rem .8rem',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  linkedinCompaniesTdNum: {
    padding: '.65rem .8rem',
    color: '#374151',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  linkedinSummaryCard: {
    width: 'min(100%, 720px)',
    minHeight: 212,
    alignSelf: 'flex-start',
    padding: 0,
    overflow: 'hidden',
    borderColor: '#E0E0E0',
    background: '#fff',
  },
  linkedinSummaryTitle: {
    padding: '1.1rem 1.35rem .55rem',
    fontSize: '.82rem',
    fontWeight: 600,
    color: '#202124',
  },
  linkedinSummaryBody: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1.55rem',
    flexWrap: 'wrap',
    padding: '.55rem 1.35rem 1.25rem',
  },
  linkedinObjectiveColumn: {
    flex: '1 1 205px',
    minWidth: 205,
  },
  linkedinObjectiveContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1.05rem',
    marginTop: '.95rem',
  },
  linkedinSpendBlock: {
    flex: '0 0 74px',
    minWidth: 74,
  },
  linkedinSpendValue: {
    display: 'block',
    fontSize: '.95rem',
    lineHeight: 1.2,
    fontWeight: 700,
    color: '#202124',
  },
  linkedinSpendBar: {
    width: 74,
    height: 17,
    marginTop: '1.05rem',
    borderRadius: 3,
    background: '#E8F0FE',
    overflow: 'hidden',
  },
  linkedinSpendFill: {
    display: 'block',
    width: '100%',
    height: '100%',
    borderRadius: 3,
    background: '#B4D6F4',
  },
  linkedinLegend: {
    display: 'flex',
    flexDirection: 'column',
    gap: '.28rem',
    minWidth: 112,
    color: '#5F6368',
    fontSize: '.72rem',
    lineHeight: 1.15,
  },
  linkedinObjectiveRow: {
    display: 'grid',
    gridTemplateColumns: '8px 30px minmax(0, 1fr)',
    alignItems: 'center',
    columnGap: '.3rem',
  },
  linkedinObjectiveDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    border: '1px solid #B4D6F4',
  },
  linkedinSummaryMetrics: {
    flex: '1 1 360px',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(66px, 1fr))',
    gap: '1.05rem',
    alignItems: 'flex-start',
  },
  linkedinSummaryMetric: {
    minWidth: 0,
  },
  linkedinMetricLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '.35rem',
    color: '#6B7280',
    fontSize: '.72rem',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  linkedinUnderlined: {
    borderBottom: '1px solid #B8BDC7',
    paddingBottom: 1,
  },
  linkedinCaret: {
    width: 0,
    height: 0,
    borderLeft: '4px solid transparent',
    borderRight: '4px solid transparent',
    borderTop: '5px solid #6B7280',
    transform: 'translateY(1px)',
  },
  linkedinMetricValue: {
    display: 'block',
    marginTop: '1rem',
    fontSize: '.95rem',
    lineHeight: 1.2,
    fontWeight: 700,
    color: '#202124',
  },
  linkedinDepthLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '.7rem',
    minHeight: 56,
    padding: '0 1.35rem',
    borderTop: '1px solid #E8EAED',
    color: '#5F6368',
    fontSize: '.74rem',
    fontWeight: 600,
  },
  linkedinArrow: {
    color: '#6B7280',
    fontSize: '1.2rem',
    lineHeight: 1,
  },
  overviewCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    paddingBottom: '.75rem',
    borderBottom: '1px solid #DADCE0',
  },
  cardTitle: { fontSize: '.88rem', fontWeight: 500, color: '#202124', letterSpacing: 0 },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    background: '#FEF7E0',
    color: '#B06000',
    padding: '.25rem .65rem',
    fontSize: '.75rem',
    fontWeight: 500,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '.5rem',
  },
  subStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    borderTop: '1px solid #E8EAED',
    marginTop: '.1rem',
  },
  metricInline: {
    padding: '.75rem 1rem .65rem 0',
    minWidth: 0,
  },
  metricLabel: {
    display: 'block',
    fontSize: '.7rem',
    color: '#5F6368',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: '.98rem',
    fontWeight: 500,
    color: '#202124',
  },
  dailyCard: {
    padding: 0,
    overflow: 'hidden',
    borderRadius: 6,
    borderColor: '#DADCE0',
    background: '#fff',
  },
  dailyTiles: {
    display: 'flex',
    alignItems: 'stretch',
    flexWrap: 'wrap',
    borderBottom: '1px solid #DADCE0',
  },
  dailyTile: {
    width: 156,
    minHeight: 88,
    padding: '.9rem 1rem .8rem',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '.55rem',
    borderRight: '1px solid rgba(255,255,255,.2)',
  },
  dailyTileLabel: {
    fontSize: '.74rem',
    fontWeight: 500,
    opacity: 0.95,
    lineHeight: 1.2,
  },
  dailyTileValue: {
    fontSize: '1.72rem',
    lineHeight: 1,
    fontWeight: 400,
    letterSpacing: 0,
    width: 'fit-content',
  },
  dailyTileNeutral: {
    background: '#F1F3F4',
    color: '#3C4043',
    borderRight: '1px solid #DADCE0',
  },
  dailyTileLabelNeutral: {
    fontSize: '.74rem',
    fontWeight: 500,
    color: '#5F6368',
    lineHeight: 1.2,
  },
  dailyTileValueNeutral: {
    fontSize: '1.72rem',
    lineHeight: 1,
    fontWeight: 400,
    color: '#3C4043',
    width: 'fit-content',
  },
  dailyChartWrap: {
    height: 248,
    padding: '.7rem 1.6rem 1rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  sectionTitle: { fontSize: '.88rem', fontWeight: 500, color: '#202124', marginBottom: '.55rem', letterSpacing: 0 },
  platformGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '.75rem',
  },
  platformCell: {
    padding: '.75rem 1rem',
    background: '#F8F9FA',
    border: '1px solid #E8EAED',
    borderRadius: 4,
    fontSize: '.85rem',
  },
  platformName: { fontWeight: 500, color: '#202124', marginBottom: '.5rem' },
  platformRow: { display: 'flex', justifyContent: 'space-between', color: '#3C4043', marginTop: 2 },
  topAdCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '.9rem',
    color: 'inherit',
    textDecoration: 'none',
  },
  carouselControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '.55rem',
  },
  carouselButton: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid #DADCE0',
    background: '#fff',
    color: '#3C4043',
    fontSize: '1rem',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  slideCount: {
    minWidth: 44,
    textAlign: 'center',
    fontSize: '.78rem',
    color: '#5F6368',
    whiteSpace: 'nowrap',
  },
  topAdBody: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1.25rem',
    alignItems: 'stretch',
  },
  adPreviewFrame: {
    flex: '2 1 620px',
    minHeight: 0,
    aspectRatio: '16 / 9',
    maxHeight: 360,
    background: '#F8F9FA',
    border: '1px solid #DADCE0',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 0,
  },
  adPreviewImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    background: '#F8F9FA',
  },
  videoPreviewButton: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  playButton: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: '50%',
    background: 'rgba(32,33,36,.82)',
    boxShadow: '0 2px 8px rgba(0,0,0,.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTop: '12px solid transparent',
    borderBottom: '12px solid transparent',
    borderLeft: '18px solid #fff',
    marginLeft: 4,
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
    background: '#F8F9FA',
  },
  adPreviewEmpty: {
    color: '#80868B',
    fontSize: '.85rem',
  },
  topAdDetails: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    flex: '1 1 280px',
    minWidth: 0,
    gap: '.75rem',
  },
  campaignLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '.45rem',
    color: 'var(--brand-primary)',
    fontSize: '.78rem',
    fontWeight: 500,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--brand-success)',
    flexShrink: 0,
  },
  topAdTitle: {
    color: '#202124',
    fontSize: '1.45rem',
    fontWeight: 500,
    lineHeight: 1.15,
    overflowWrap: 'anywhere',
  },
  topAdSubtitle: {
    color: '#5F6368',
    fontSize: '.82rem',
    lineHeight: 1.35,
  },
  adStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(120px, 1fr))',
    border: '1px solid #E8EAED',
    borderRadius: 4,
    overflow: 'hidden',
  },
  adStat: {
    padding: '.8rem .9rem',
    borderRight: '1px solid #E8EAED',
    borderBottom: '1px solid #E8EAED',
    minWidth: 0,
  },
  adStatLabel: { color: '#5F6368', fontSize: '.7rem', marginBottom: '.2rem' },
  adStatValue: {
    color: '#202124',
    fontSize: '1rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  dotRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '.4rem',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: '50%',
    border: '1px solid #9AA0A6',
    background: '#fff',
    padding: 0,
    cursor: 'pointer',
  },
  dotActive: {
    width: 24,
    borderRadius: 999,
    borderColor: 'var(--brand-primary)',
    background: 'var(--brand-primary)',
  },
  highlightsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '.75rem',
  },
  topFiveGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '.75rem',
  },
  topFiveCard: { padding: '1rem 1.1rem' },
  topFiveHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '.2rem',
  },
  textLink: { fontSize: '.8rem', fontWeight: 500, color: 'var(--brand-primary)' },
  rankList: { display: 'flex', flexDirection: 'column' },
  rankRow: {
    display: 'grid',
    gridTemplateColumns: '28px minmax(0, 1fr) auto',
    gap: '.75rem',
    alignItems: 'center',
    padding: '.7rem 0',
    borderTop: '1px solid #F1F3F4',
  },
  rankNumber: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: 'var(--brand-primary-light)',
    color: 'var(--brand-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '.75rem',
    fontWeight: 700,
  },
  rankMain: { minWidth: 0 },
  rankName: {
    color: '#202124',
    fontSize: '.88rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rankMeta: { color: '#5F6368', fontSize: '.75rem', marginTop: 2 },
  rankMetric: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    color: '#5F6368',
    fontSize: '.75rem',
    whiteSpace: 'nowrap',
  },
  geoTeaser: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  centered: { display: 'flex', justifyContent: 'center', padding: '4rem 0' },
};
