import React, { useState } from 'react';
import { fmt, money, pct, platformLabel } from '../utils/format';

const BASE_COLS = [
  { key: 'campaign_name', label: 'Campaign' },
  { key: 'platform',      label: 'Platform' },
  { key: 'campaign_status', label: 'Status' },
  { key: 'impressions',   label: 'Impr.',         num: true },
  { key: 'clicks',        label: 'Clicks',        num: true },
  { key: 'ctr',           label: 'CTR',           num: true },
  { key: 'cost',          label: 'Cost',          num: true },
  { key: 'avg_cpc',       label: 'Avg CPC',       num: true },
  { key: 'avg_cpm',       label: 'Avg CPM',       num: true },
  { key: 'conversions',   label: 'Conv.',         num: true },
];

export default function CampaignTable({ campaigns = [], currency }) {
  const [sort, setSort] = useState({ key: 'cost', dir: 'desc' });
  const isVideo = campaigns.some((campaign) => campaign.sub_platform === 'video');
  const cols = isVideo
    ? [
        ...BASE_COLS.slice(0, -1),
        { key: 'viewable_impressions', label: 'TrueView views', num: true },
        { key: 'viewable_ctr', label: 'View rate', num: true },
        BASE_COLS[BASE_COLS.length - 1],
      ]
    : [
        ...BASE_COLS.slice(0, -1),
        { key: 'viewable_ctr', label: 'Viewable CTR', num: true },
        BASE_COLS[BASE_COLS.length - 1],
      ];

  const sorted = [...campaigns].sort((a, b) => {
    const va = a[sort.key] ?? 0;
    const vb = b[sort.key] ?? 0;
    if (typeof va === 'string') return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    return sort.dir === 'asc' ? va - vb : vb - va;
  });

  const toggleSort = (key) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderColor: '#DADCE0', borderRadius: 6 }}>
      <div style={styles.header}>
        <h3 style={styles.title}>Campaigns</h3>
        <span style={styles.count}>{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {cols.map((col) => (
                <th
                  key={col.key}
                  style={{ ...styles.th, textAlign: col.num ? 'right' : 'left' }}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  {sort.key === col.key && (
                    <span style={styles.sortIcon}>{sort.dir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} style={styles.tr}>
                {cols.map((col) => (
                  <td key={col.key} style={{ ...styles.td, textAlign: col.num ? 'right' : 'left' }}>
                    {formatCell(c, col.key, currency)}
                  </td>
                ))}
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={cols.length} style={{ ...styles.td, textAlign: 'center', color: '#80868B', padding: '2rem' }}>
                  No campaigns for selected period / platform
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(c, key, currency) {
  if (key === 'campaign_name') return <span style={styles.campaignName}>{c.campaign_name}</span>;
  if (key === 'platform') {
    return (
      <span className={`badge badge-${c.platform}`}>
        {platformLabel(c.platform, c.sub_platform)}
      </span>
    );
  }
  if (key === 'campaign_status') {
    return (
      <span className="badge badge-paused">
        Paused
      </span>
    );
  }
  if (key === 'cost' || key === 'avg_cpc' || key === 'avg_cpm') {
    return money(c[key], c.currency || currency);
  }
  if (key === 'ctr' || key === 'viewable_ctr') return pctOrDash(c[key]);
  return fmt(c[key]);
}

function pctOrDash(value) {
  const number = Number(value || 0);
  return number > 0 ? pct(number) : '-';
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '.7rem .85rem',
    minHeight: 44,
    borderBottom: '1px solid #DADCE0',
  },
  title: { fontSize: '.82rem', fontWeight: 500, color: '#3C4043', letterSpacing: 0 },
  count: { fontSize: '.72rem', color: '#5F6368' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' },
  th: {
    height: 42,
    padding: '.55rem .75rem',
    background: '#FFFFFF',
    color: '#5F6368',
    fontWeight: 500,
    fontSize: '.72rem',
    textTransform: 'none',
    letterSpacing: 0,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #DADCE0',
  },
  td: {
    height: 42,
    padding: '.55rem .75rem',
    borderBottom: '1px solid #E8EAED',
    color: '#3C4043',
    whiteSpace: 'nowrap',
  },
  tr: { transition: 'background .1s' },
  campaignName: { fontWeight: 400, color: '#1A73E8' },
  sortIcon: { marginLeft: 4, color: '#5F6368', fontSize: '.75rem' },
};
