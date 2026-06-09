import React, { useEffect, useState } from 'react';
import { getPeriods, getAds, getDailyPerformance } from '../services/api';
import DateRangePanel from '../components/DateRangePanel';
import AdTypeTabs from '../components/AdTypeTabs';
import { usePlatform } from '../context/PlatformContext';
import { fmt, money, pctOrDash, platformLabel } from '../utils/format';
import { REPORT_END_DATE, REPORT_START_DATE, buildRangeMeta, clampDateValue, dailyMetricFactors, scaleMetricRowWithFactors } from '../utils/dateRange';

const COLS = [
  { key: 'ad_name',           label: 'Ad',                stick: true },
  { key: 'campaign_name',     label: 'Campaign' },
  { key: 'ad_group',          label: 'Ad group' },
  { key: 'ad_status',         label: 'Status' },
  { key: 'clicks',            label: 'Clicks',            num: true },
  { key: 'impressions',       label: 'Impr.',             num: true },
  { key: 'ctr',               label: 'CTR',               num: true },
  { key: 'avg_cpc',           label: 'Avg. CPC',          num: true },
  { key: 'avg_cpm',           label: 'Avg. CPM',          num: true },
  { key: 'cost',              label: 'Cost',              num: true },
  { key: 'viewable_ctr',      label: 'Viewable CTR',      num: true },
  { key: 'viewable_impressions', label: 'Viewable impr.', num: true },
  { key: 'conv_rate',         label: 'Conv. rate',        num: true },
  { key: 'conversions',       label: 'Conversions',       num: true },
  { key: 'cost_per_conv',     label: 'Cost / conv.',      num: true },
];

export default function Ads() {
  const { platform, selectedAdType, setSelectedAdType } = usePlatform();
  const [periods,  setPeriods]  = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState('');
  const [selectedEndDate, setSelectedEndDate] = useState('');
  const [sort,     setSort]     = useState({ key: 'impressions', dir: 'desc' });
  const [ads,      setAds]      = useState([]);
  const [dailyRows, setDailyRows] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [preview,  setPreview]  = useState(null);   // ad object being previewed

  useEffect(() => {
    getPeriods().then((r) => {
      setPeriods(r.data);
    }).catch(() => setError('Failed to load periods.'));
  }, []);

  const platformPeriods = periods.filter((p) => p.platform === platform);
  const selected = periods.find((p) => String(p.id) === periodId);
  const importedStartDate = selected ? REPORT_START_DATE : '';
  const importedEndDate = selected ? REPORT_END_DATE : '';

  useEffect(() => {
    if (platformPeriods.length === 0) {
      setPeriodId('');
      setAds([]);
      return;
    }
    const preferred = platformPeriods.find((p) => p.sub_platform === selectedAdType) || platformPeriods[0];
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
    Promise.all([
      getAds({ period: periodId, sortBy: sort.key, order: sort.dir }),
      selected?.sub_platform === 'video'
        ? getDailyPerformance({ period: periodId })
        : Promise.resolve({ data: { rows: [] } }),
    ])
      .then(([a, d]) => {
        setAds(a.data);
        setDailyRows(d.data.rows || []);
      })
      .catch(() => setError('Failed to load ads.'))
      .finally(() => setLoading(false));
  }, [periodId, sort, selected?.sub_platform]);

  // Close preview on ESC; lock background scroll while open.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e) => { if (e.key === 'Escape') setPreview(null); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [preview]);

  const rangeMeta = buildRangeMeta(selected, selectedStartDate, selectedEndDate);
  const {
    startDate: rangeStartDate,
    endDate: rangeEndDate,
    factor: rangeFactor,
    label: rangeLabel,
  } = rangeMeta;
  const isVideoView = selected?.sub_platform === 'video';
  const isLinkedInImageView = platform === 'linkedin' && selected?.sub_platform === 'image';
  const metricFactors = isVideoView ? dailyMetricFactors(dailyRows, rangeStartDate, rangeEndDate) : null;
  const rangeAds = ads.map((ad) => scaleMetricRowWithFactors(ad, metricFactors, rangeFactor));
  const currency = rangeAds[0]?.currency || ads[0]?.currency;
  const tableAds = isVideoView
    ? [...rangeAds].sort((a, b) => (b.viewable_impressions || 0) - (a.viewable_impressions || 0))
    : rangeAds;
  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
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

  // Image URL = /assets/<source_dir>/ads/<filename>
  const imageUrl = (ad) => ad.image_filename
    ? `/assets/${encodeURIComponent(ad.source_dir)}/ads/${encodeURIComponent(ad.image_filename)}`
    : null;

  // Extract a clean display name from the stored filename-based ad_name.
  // "01 970 × 250 (Billboard)" → "Billboard"
  // Falls back to the original string if no parens are found.
  const prettyName = (name) => {
    if (!name) return '';
    const m = name.match(/\(([^)]+)\)\s*$/);
    return m ? m[1].trim() : name;
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.pageTitle}>Ads</h1>
          <p style={styles.pageSubtitle}>
            {selected ? `${platformLabel(selected.platform, selected.sub_platform)} · ${rangeLabel}` : 'Creative performance'}
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

      {preview && (
        <div style={styles.modalBackdrop} onClick={() => setPreview(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
            <div style={styles.modalTitle}>Ad preview</div>
              <button type="button" onClick={() => setPreview(null)} style={styles.closeBtn} aria-label="Close">×</button>
            </div>
            <div style={styles.modalBody}>
              {youtubeVideoId(preview) ? (
                <iframe
                  title={preview.ad_name || 'Video ad'}
                  src={`https://www.youtube.com/embed/${youtubeVideoId(preview)}?autoplay=1&rel=0`}
                  style={styles.modalVideo}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <img src={imageUrl(preview)} alt="" style={styles.modalImg} />
              )}
            </div>
            <div style={styles.modalStats}>
              <Stat label="Impressions" value={fmt(preview.impressions)} />
              <Stat label="Clicks"      value={fmt(preview.clicks)} />
              <Stat label="CTR"         value={pctOrDash(preview.ctr)} />
              <Stat label="Avg. CPC"    value={money(preview.avg_cpc, preview.currency)} />
              <Stat label="Avg. CPM"    value={money(preview.avg_cpm, preview.currency)} />
              <Stat label="Cost"        value={money(preview.cost, preview.currency)} />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={styles.centered}><div className="spinner" /></div>
      ) : (
        <>
          {isLinkedInImageView && (
            <LinkedInImageAdsSummary
              ads={rangeAds}
              currency={currency}
              rangeLabel={rangeLabel}
            />
          )}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {!isVideoView && (
              <div style={styles.tableHeader}>
                <div>
                  <h3 style={styles.title}>
                    {isLinkedInImageView ? 'LinkedIn image ads' : 'Creative performance'}
                  </h3>
                  {isLinkedInImageView && <p style={styles.tableSubtitle}>{rangeLabel}</p>}
                </div>
                <span style={styles.count}>{tableAds.length} ad{tableAds.length === 1 ? '' : 's'}</span>
              </div>
            )}
            <div style={{ overflowX: 'auto' }}>
              {isVideoView ? (
                <GoogleVideoAdsTable
                  ads={tableAds}
                  currency={currency}
                  imageUrl={imageUrl}
                  onPreview={setPreview}
                />
              ) : isLinkedInImageView ? (
                <LinkedInImageAdsTable
                  ads={tableAds}
                  currency={currency}
                  imageUrl={imageUrl}
                  onPreview={setPreview}
                  sort={sort}
                  onSort={toggleSort}
                />
              ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 96 }}>Ad</th>
                    {COLS.slice(1).map((col) => (
                      <th
                        key={col.key}
                        style={{ ...styles.th, textAlign: col.num ? 'right' : 'left' }}
                        onClick={() => toggleSort(col.key)}
                      >
                        {col.label}
                        {sort.key === col.key && (
                          <span style={{ marginLeft: 4, opacity: .6 }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableAds.map((a) => (
                    <tr key={a.id} style={styles.tr}>
                      <td style={{ ...styles.td, padding: '.5rem .75rem' }}>
                        <button
                          type="button"
                          onClick={() => imageUrl(a) && setPreview(a)}
                          style={styles.thumbBtn}
                          title="Click to preview"
                        >
                          {imageUrl(a) ? (
                            <img src={imageUrl(a)} alt="" style={styles.thumb} loading="lazy" />
                          ) : (
                            <div style={{ ...styles.thumb, background: '#F1F3F4' }} />
                          )}
                        </button>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.linkText}>{a.campaign_name}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.linkText}>{a.ad_group}</span>
                      </td>
                      <td style={styles.td}>
                        <span className="badge badge-paused">
                          Paused
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(a.clicks)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(a.impressions)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{pctOrDash(a.ctr)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{money(a.avg_cpc, currency)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{money(a.avg_cpm, currency)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{money(a.cost, currency)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{pctOrDash(a.viewable_ctr)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(a.viewable_impressions)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{pctOrDash(a.conv_rate)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{Number(a.conversions || 0).toFixed(2)}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>{money(a.cost_per_conv, currency)}</td>
                    </tr>
                  ))}
                  {!tableAds.length && (
                    <tr>
                      <td colSpan={COLS.length + 1} style={{ ...styles.td, textAlign: 'center', color: '#80868B', padding: '2rem' }}>
                        No ads for selected period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LinkedInImageAdsSummary({ ads, currency, rangeLabel }) {
  const totals = ads.reduce((acc, ad) => {
    acc.impressions += Number(ad.impressions || 0);
    acc.clicks += Number(ad.clicks || 0);
    acc.cost += Number(ad.cost || 0);
    return acc;
  }, { impressions: 0, clicks: 0, cost: 0 });
  const ctr = totals.impressions ? totals.clicks * 100 / totals.impressions : 0;
  const cpc = totals.clicks ? totals.cost / totals.clicks : 0;
  const cpm = totals.impressions ? totals.cost * 1000 / totals.impressions : 0;

  const metrics = [
    ['Spend', money(totals.cost, currency)],
    ['Impressions', fmt(totals.impressions)],
    ['Clicks', fmt(totals.clicks)],
    ['CTR', pctOrDash(ctr)],
    ['Avg. CPC', money(cpc, currency)],
    ['Avg. CPM', money(cpm, currency)],
  ];

  return (
    <section className="card" style={styles.linkedinImageSummary}>
      <div style={styles.linkedinImageSummaryHeader}>
        <div>
          <h2 style={styles.linkedinImageSummaryTitle}>LinkedIn Image Ads</h2>
          <p style={styles.linkedinImageSummarySub}>{rangeLabel}</p>
        </div>
        <span style={styles.linkedinImageSummaryCount}>{ads.length} creatives</span>
      </div>
      <div style={styles.linkedinImageSummaryGrid}>
        {metrics.map(([label, value]) => (
          <div key={label} style={styles.linkedinImageSummaryMetric}>
            <span style={styles.linkedinImageMetricLabel}>{label}</span>
            <strong style={styles.linkedinImageMetricValue}>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

const LINKEDIN_IMAGE_TABLE_COLS = [
  { key: 'impressions', label: 'Impr.', format: fmt },
  { key: 'clicks', label: 'Clicks', format: fmt },
  { key: 'ctr', label: 'CTR', format: pctOrDash },
  { key: 'avg_cpc', label: 'Avg. CPC', format: (value, currency) => money(value, currency) },
  { key: 'avg_cpm', label: 'Avg. CPM', format: (value, currency) => money(value, currency) },
  { key: 'cost', label: 'Spend', format: (value, currency) => money(value, currency) },
];

function LinkedInImageAdsTable({ ads, currency, imageUrl, onPreview, sort, onSort }) {
  return (
    <table style={styles.linkedinImageTable}>
      <thead>
        <tr>
          <LinkedInSortableTh
            label="Ad"
            sortKey="ad_name"
            sort={sort}
            onSort={onSort}
            style={{ width: 330 }}
          />
          <th style={{ ...styles.linkedinImageTh, minWidth: 150 }}>Ad set</th>
          <th style={{ ...styles.linkedinImageTh, minWidth: 260 }}>Campaign</th>
          <th style={{ ...styles.linkedinImageTh, minWidth: 105 }}>Status</th>
          {LINKEDIN_IMAGE_TABLE_COLS.map((col) => (
            <LinkedInSortableTh
              key={col.key}
              label={col.label}
              sortKey={col.key}
              sort={sort}
              onSort={onSort}
              style={{ minWidth: 105, textAlign: 'right' }}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {ads.map((ad) => {
          const src = imageUrl(ad);
          return (
            <tr key={ad.id} style={styles.linkedinImageTr}>
              <td style={styles.linkedinImageAdTd}>
                <button
                  type="button"
                  onClick={() => src && onPreview(ad)}
                  style={styles.linkedinImageThumbButton}
                  aria-label={`Preview ${ad.ad_name || 'ad'}`}
                >
                  {src ? (
                    <img src={src} alt="" style={styles.linkedinImageThumb} loading="lazy" />
                  ) : (
                    <span style={styles.linkedinImageThumbEmpty} />
                  )}
                </button>
                <div style={styles.linkedinImageAdText}>
                  <strong style={styles.linkedinImageAdTitle} title={ad.ad_name}>{linkedInAdDisplayName(ad.ad_name)}</strong>
                  <span style={styles.linkedinImageAdSub}>{linkedInAdSubline(ad)}</span>
                </div>
              </td>
              <td style={styles.linkedinImageTd}>
                <span style={styles.linkText}>{ad.ad_group || '-'}</span>
              </td>
              <td style={styles.linkedinImageTd}>
                <span title={ad.campaign_name}>{ad.campaign_name || '-'}</span>
              </td>
              <td style={styles.linkedinImageTd}>
                <span className="badge badge-paused">
                  Paused
                </span>
              </td>
              {LINKEDIN_IMAGE_TABLE_COLS.map((col) => (
                <td key={col.key} style={{ ...styles.linkedinImageTd, textAlign: 'right' }}>
                  {col.format(ad[col.key], currency)}
                </td>
              ))}
            </tr>
          );
        })}
        {!ads.length && (
          <tr>
            <td colSpan={LINKEDIN_IMAGE_TABLE_COLS.length + 4} style={styles.linkedinImageEmpty}>
              No ads for selected period
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function LinkedInSortableTh({ label, sortKey, sort, onSort, style }) {
  const active = sort.key === sortKey;
  return (
    <th
      style={{ ...styles.linkedinImageTh, ...style, cursor: 'pointer' }}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {active && <span style={styles.sortIndicator}>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}

function linkedInAdDisplayName(name) {
  if (!name) return 'Image ad';
  const match = String(name).match(/^(Ad Copy\s+\d+)/i);
  return match ? match[1] : name;
}

function linkedInAdSubline(ad) {
  const id = String(ad.ad_name || '').match(/-\s*(\d+)\s*$/)?.[1];
  const parts = [];
  if (id) parts.push(`ID ${id}`);
  if (ad.image_filename) parts.push(ad.image_filename.replace(/\.[^.]+$/, ''));
  return parts.join(' · ') || ad.image_size || 'Single image ad';
}

function GoogleVideoAdsTable({ ads, currency, imageUrl, onPreview }) {
  return (
    <table style={styles.googleTable}>
      <thead>
        <tr>
          <th style={{ ...styles.googleTh, width: 28 }}><span style={styles.headerDot} /></th>
          <th style={{ ...styles.googleTh, minWidth: 320 }}>Ad</th>
          <th style={{ ...styles.googleTh, minWidth: 92 }}>Ad group</th>
          <th style={{ ...styles.googleTh, minWidth: 110 }}>Status</th>
          <th style={{ ...styles.googleTh, minWidth: 130 }}>Ad type</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 92 }}>Impr.</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 118 }}>TrueView views</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 105 }}>Avg. CPM</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 110 }}>Cost</th>
          <th style={{ ...styles.googleTh, minWidth: 240 }}>Video</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 88 }}>Clicks</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 118 }}>Interactions</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 105 }}>Avg. CPC</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 120 }}>TrueView avg. CPV</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 105 }}>Watch time</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 130 }}>Avg. watch time / impr.</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 86 }}>CTR</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 95 }}>Conv. rate</th>
          <th style={{ ...styles.googleTh, ...styles.num, minWidth: 105 }}>Cost / conv.</th>
        </tr>
      </thead>
      <tbody>
        {ads.map((ad) => (
          <tr key={ad.id} style={styles.googleTr}>
            <td style={styles.statusCell}><span style={styles.pausedDot} /></td>
            <td style={styles.googleTd}>
              <div style={styles.videoAdCell}>
                <div style={styles.adNumber}>{adNumberLabel(ad)}</div>
                <button
                  type="button"
                  style={styles.videoThumbButton}
                  onClick={() => onPreview(ad)}
                  aria-label={`Preview ${ad.ad_name}`}
                >
                  {imageUrl(ad) ? (
                    <img src={imageUrl(ad)} alt="" style={styles.videoThumb} loading="lazy" />
                  ) : (
                    <span style={styles.videoThumbEmpty} />
                  )}
                </button>
                <div style={styles.videoAdCopy}>
                  <div style={styles.videoAdTitle} title={assetTitle(ad)}>{assetTitle(ad)}</div>
                  <div style={styles.videoAdCampaign}>{ad.campaign_name}</div>
                  <button type="button" onClick={() => onPreview(ad)} style={styles.assetLink}>View asset details</button>
                </div>
              </div>
            </td>
            <td style={styles.googleTd}><span style={styles.tableLink}>{ad.ad_group}</span></td>
            <td style={styles.googleTd}>Paused</td>
            <td style={styles.googleTd}>Responsive video ad</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{fmt(ad.impressions)}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{fmt(ad.viewable_impressions)}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{money(calcCpm(ad), currency)}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{money(ad.cost, currency)}</td>
            <td style={styles.googleTd}>
              <a href={youtubeUrl(ad)} target="_blank" rel="noreferrer" style={styles.tableLink}>
                {videoLinkLabel(ad)}
              </a>
            </td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{fmt(ad.clicks)}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>
              <div>{fmt(ad.viewable_impressions)}</div>
              <div style={styles.mutedSmall}>engagements</div>
            </td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{ad.clicks ? money(ad.avg_cpc, currency) : '-'}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{money(trueViewCpv(ad), currency)}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{watchTime()}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{avgWatchTimePerImpression()}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{pctOrDash(ad.ctr)}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{pctOrDash(ad.conv_rate)}</td>
            <td style={{ ...styles.googleTd, ...styles.num }}>{money(ad.cost_per_conv, currency)}</td>
          </tr>
        ))}
        {!ads.length && (
          <tr>
            <td colSpan={19} style={{ ...styles.googleTd, textAlign: 'center', padding: '2rem', color: '#80868B' }}>
              No ads for selected period
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function adNumberLabel(ad) {
  const match = String(ad.ad_name || '').match(/(\d+)/);
  return match ? `Ad #${match[1]}` : 'Ad';
}

function assetTitle(ad) {
  if (ad?.platform === 'linkedin' && ad?.sub_platform === 'video') {
    return linkedInVideoAdHeadline(ad);
  }
  return `${ad.ad_name}: KLE Academy Of Higher Education & Research`;
}

function videoLinkLabel(ad) {
  if (ad?.platform === 'linkedin' && ad?.sub_platform === 'video') {
    return linkedInVideoAdHeadline(ad);
  }
  return 'KAHER: Nurturing Leaders through Learning, Innovation...';
}

function linkedInVideoAdHeadline(ad) {
  if (/basic science|dsir/i.test(ad?.ad_name || '')) {
    return 'Pioneering Research at KAHER: DSIR-Approved Basic Science Center';
  }
  if (/video\s+2/i.test(ad?.ad_name || '')) {
    return '110 Years of Academic Excellence & Innovation at KAHER';
  }
  return ad?.ad_name || 'LinkedIn video ad';
}

function trueViewCpv(ad) {
  return ad.viewable_impressions ? ad.cost / ad.viewable_impressions : 0;
}

function calcCpm(ad) {
  return ad.impressions ? ad.cost * 1000 / ad.impressions : 0;
}

function watchTime() {
  return '-';
}

function avgWatchTimePerImpression() {
  return '-';
}

function youtubeVideoId(ad) {
  const match = ad?.image_filename?.match(/^youtube-([A-Za-z0-9_-]+)\./);
  return match ? match[1] : null;
}

function youtubeUrl(ad) {
  const id = youtubeVideoId(ad);
  return id ? `https://www.youtube.com/watch?v=${id}` : '#';
}

function Stat({ label, value }) {
  return (
    <div style={statStyles.cell}>
      <div style={statStyles.label}>{label}</div>
      <div style={statStyles.value}>{value}</div>
    </div>
  );
}

const statStyles = {
  cell:  { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 120 },
  label: { fontSize: '.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', color: '#5F6368' },
  value: { fontSize: '1.05rem', fontWeight: 600, color: '#202124' },
};

const styles = {
  page: { maxWidth: 1600, margin: '0 auto', padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  topBar: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, color: '#202124' },
  pageSubtitle: { fontSize: '.85rem', color: '#5F6368', marginTop: '.25rem' },
  headerControls: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: '.7rem',
    flexWrap: 'wrap',
    flex: '1 1 640px',
  },
  filters: { display: 'flex', gap: '.5rem', alignItems: 'center' },
  select: {
    padding: '.45rem .8rem',
    border: '1px solid #DADCE0',
    borderRadius: 8,
    fontSize: '.875rem',
    background: '#fff',
    color: '#3C4043',
    cursor: 'pointer',
    minWidth: 280,
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid #E8EAED',
  },
  title: { fontSize: '1rem', fontWeight: 600, color: '#202124' },
  tableSubtitle: { marginTop: 3, fontSize: '.78rem', color: '#6B7280' },
  count: { fontSize: '.8rem', color: '#80868B' },
  linkedinImageSummary: {
    padding: '1rem 1.25rem',
    borderLeft: '4px solid #0A66C2',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  linkedinImageSummaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  linkedinImageSummaryTitle: {
    margin: 0,
    color: '#17233C',
    fontSize: '1.08rem',
    fontWeight: 700,
  },
  linkedinImageSummarySub: {
    marginTop: 4,
    color: '#64748B',
    fontSize: '.82rem',
  },
  linkedinImageSummaryCount: {
    alignSelf: 'center',
    background: '#E1EEF7',
    color: '#0A66C2',
    borderRadius: 999,
    padding: '.28rem .65rem',
    fontSize: '.75rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  linkedinImageSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
    gap: '.75rem',
  },
  linkedinImageSummaryMetric: {
    minHeight: 72,
    border: '1px solid #D6E6F3',
    borderRadius: 6,
    background: '#F7FBFE',
    padding: '.75rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '.45rem',
  },
  linkedinImageMetricLabel: {
    color: '#64748B',
    fontSize: '.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  linkedinImageMetricValue: {
    color: '#17233C',
    fontSize: '1.05rem',
    fontWeight: 700,
  },
  linkedinImageTable: {
    width: '100%',
    minWidth: 1220,
    borderCollapse: 'collapse',
    fontSize: '.82rem',
  },
  linkedinImageTh: {
    padding: '.68rem .8rem',
    background: '#F8FAFC',
    color: '#475569',
    fontWeight: 700,
    fontSize: '.72rem',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    borderBottom: '1px solid #D9E2EC',
  },
  linkedinImageTr: {
    background: '#fff',
  },
  linkedinImageTd: {
    padding: '.72rem .8rem',
    borderBottom: '1px solid #EEF2F7',
    color: '#334155',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    maxWidth: 280,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  linkedinImageAdTd: {
    padding: '.65rem .8rem',
    borderBottom: '1px solid #EEF2F7',
    display: 'flex',
    alignItems: 'center',
    gap: '.75rem',
    minWidth: 330,
  },
  linkedinImageThumbButton: {
    width: 64,
    height: 64,
    border: '1px solid #D9E2EC',
    borderRadius: 6,
    padding: 0,
    background: '#F8FAFC',
    overflow: 'hidden',
    cursor: 'zoom-in',
    flex: '0 0 auto',
  },
  linkedinImageThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  linkedinImageThumbEmpty: {
    display: 'block',
    width: '100%',
    height: '100%',
    background: '#E2E8F0',
  },
  linkedinImageAdText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  linkedinImageAdTitle: {
    color: '#17233C',
    fontSize: '.88rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 230,
  },
  linkedinImageAdSub: {
    color: '#64748B',
    fontSize: '.72rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 230,
  },
  sortIndicator: {
    marginLeft: 5,
    color: '#0A66C2',
    fontSize: '.75rem',
  },
  linkedinImageEmpty: {
    padding: '2rem',
    textAlign: 'center',
    color: '#80868B',
    borderBottom: '1px solid #EEF2F7',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' },
  googleTable: {
    width: '100%',
    minWidth: 1960,
    borderCollapse: 'collapse',
    fontSize: '.78rem',
    color: '#3C4043',
  },
  googleTh: {
    padding: '.45rem .55rem',
    background: '#fff',
    color: '#3C4043',
    fontWeight: 500,
    fontSize: '.7rem',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    borderBottom: '1px solid #DADCE0',
    borderRight: '1px solid #E8EAED',
  },
  googleTd: {
    padding: '.7rem .55rem',
    borderBottom: '1px solid #DADCE0',
    borderRight: '1px solid #E8EAED',
    color: '#3C4043',
    verticalAlign: 'middle',
    background: '#fff',
  },
  googleTr: {
    minHeight: 100,
  },
  num: {
    textAlign: 'right',
  },
  statusCell: {
    width: 28,
    padding: '.7rem .35rem',
    textAlign: 'center',
    borderBottom: '1px solid #DADCE0',
    borderRight: '1px solid #E8EAED',
    background: '#fff',
  },
  headerDot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#5F6368',
  },
  pausedDot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#B06000',
  },
  videoAdCell: {
    display: 'grid',
    gridTemplateColumns: '58px 96px minmax(150px, 1fr)',
    gap: '.55rem',
    alignItems: 'center',
    minWidth: 310,
  },
  adNumber: {
    color: '#3C4043',
    fontSize: '.76rem',
    whiteSpace: 'nowrap',
  },
  videoThumbButton: {
    position: 'relative',
    width: 92,
    height: 52,
    border: 'none',
    padding: 0,
    background: '#F1F3F4',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  videoThumbEmpty: {
    display: 'block',
    width: '100%',
    height: '100%',
    background: '#F1F3F4',
  },
  videoAdCopy: {
    minWidth: 0,
  },
  videoAdTitle: {
    maxWidth: 190,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#202124',
    marginBottom: 2,
  },
  videoAdCampaign: {
    maxWidth: 190,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#3C4043',
    fontSize: '.7rem',
  },
  assetLink: {
    border: 'none',
    background: 'transparent',
    padding: 0,
    color: '#1A73E8',
    fontSize: '.7rem',
    cursor: 'pointer',
  },
  tableLink: {
    color: '#1A73E8',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  },
  mutedSmall: {
    color: '#5F6368',
    fontSize: '.68rem',
  },
  th: {
    padding: '.625rem 1rem',
    background: '#F8F9FA',
    color: '#5F6368',
    fontWeight: 600,
    fontSize: '.72rem',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    borderBottom: '1px solid #E8EAED',
  },
  td: {
    padding: '.75rem 1rem',
    borderBottom: '1px solid #F1F3F4',
    color: '#3C4043',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
  },
  tr: { transition: 'background .1s' },
  adCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '.75rem',
    minWidth: 220,
  },
  thumbBtn: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'zoom-in',
    borderRadius: 4,
  },
  thumb: {
    width: 72,
    height: 54,
    objectFit: 'cover',
    borderRadius: 4,
    border: '1px solid #E8EAED',
    background: '#FFFFFF',
    transition: 'transform .15s, box-shadow .15s',
  },
  sizeChip: {
    position: 'absolute',
    bottom: 2, left: 2,
    fontSize: '.62rem',
    padding: '1px 4px',
    background: 'rgba(0,0,0,.65)',
    color: '#fff',
    borderRadius: 3,
    pointerEvents: 'none',
  },
  adName: { fontWeight: 500, color: '#202124', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' },
  adSub: { fontSize: '.7rem', color: '#80868B', marginTop: 2 },
  linkText: { color: 'var(--brand-primary)' },
  centered: { display: 'flex', justifyContent: 'center', padding: '4rem 0' },

  // ── Image preview modal ──────────────────────────────────────────────────
  modalBackdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(32,33,36,.78)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
    padding: '2rem',
    animation: 'fadeIn .15s ease-out',
  },
  modalCard: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 24px 60px rgba(0,0,0,.35)',
    maxWidth: '92vw',
    maxHeight: '92vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #E8EAED',
  },
  modalTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#202124',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '70vw',
  },
  modalSub: {
    fontSize: '.8rem',
    color: '#5F6368',
    marginTop: 2,
  },
  modalDot: { margin: '0 .35rem' },
  modalBody: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F8F9FA',
    padding: '1.5rem',
    flex: 1,
    overflow: 'auto',
  },
  modalImg: {
    maxWidth: '100%',
    maxHeight: '70vh',
    objectFit: 'contain',
    borderRadius: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,.1)',
  },
  modalVideo: {
    width: 'min(960px, 86vw)',
    aspectRatio: '16 / 9',
    border: 'none',
    background: '#F8F9FA',
  },
  modalStats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1.5rem',
    padding: '1rem 1.25rem',
    borderTop: '1px solid #E8EAED',
    background: '#fff',
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    fontSize: '1.75rem',
    lineHeight: 1,
    color: '#5F6368',
    cursor: 'pointer',
    padding: '0 .25rem',
  },
};
