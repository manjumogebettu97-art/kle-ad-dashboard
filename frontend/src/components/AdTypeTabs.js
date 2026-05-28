import React from 'react';
import { shortViewLabel } from '../utils/dateRange';

export default function AdTypeTabs({ items, views, activeKey, onChange }) {
  const tabItems = items || views || [];
  if (!tabItems.length) return null;

  return (
    <div style={styles.viewTabs} aria-label="Ad type">
      {tabItems.map((item) => {
        const key = item.key || String(item.id);
        const active = key === String(activeKey);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            style={{
              ...styles.viewTab,
              ...(active ? styles.viewTabActive : {}),
            }}
            aria-pressed={active}
          >
            {item.shortLabel || shortViewLabel(item)}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  viewTabs: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    padding: 3,
    background: '#fff',
    border: '1px solid #C9CDD1',
    borderRadius: 4,
    boxShadow: '0 1px 1px rgba(60,64,67,.06)',
  },
  viewTab: {
    minHeight: 28,
    padding: '.28rem .65rem',
    border: '1px solid transparent',
    borderRadius: 3,
    background: 'transparent',
    color: '#5F6368',
    fontSize: '.74rem',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  viewTabActive: {
    background: 'var(--brand-primary-light)',
    borderColor: 'var(--brand-primary)',
    color: 'var(--brand-primary)',
  },
};
