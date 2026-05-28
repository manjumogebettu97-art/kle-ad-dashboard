import React from 'react';
import TooltipValue from './TooltipValue';

// Solid-color KPI tile, Google Ads UI style.
export default function KpiCard({ title, value, tooltip, background = '#1A73E8' }) {
  return (
    <div style={{ ...styles.tile, background }}>
      <div style={styles.top}>
        <span style={styles.label}>{title}</span>
      </div>
      <TooltipValue valueStyle={styles.value} tooltip={tooltip}>
        {value ?? '—'}
      </TooltipValue>
    </div>
  );
}

const styles = {
  tile: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '1.5rem',
    padding: '.9rem 1rem',
    borderRadius: 4,
    minHeight: 88,
    color: '#fff',
    boxShadow: 'none',
  },
  top: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '.5rem',
  },
  label: {
    fontSize: '.74rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,.92)',
    letterSpacing: '.01em',
  },
  value: {
    fontSize: '1.72rem',
    fontWeight: 400,
    lineHeight: 1.05,
    color: '#fff',
    width: 'fit-content',
  },
};
