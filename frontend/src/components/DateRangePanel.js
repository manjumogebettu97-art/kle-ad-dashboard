import React from 'react';

export default function DateRangePanel({
  startDate,
  endDate,
  minDate,
  maxDate,
  disabled,
  onStartChange,
  onEndChange,
}) {
  return (
    <div style={styles.datePanel} aria-label="Date range">
      <div style={styles.dateFields}>
        <label style={styles.dateField}>
          <span style={styles.dateLabel}>Start date</span>
          <input
            type="date"
            value={startDate || ''}
            min={minDate || ''}
            max={endDate || maxDate || ''}
            disabled={disabled}
            onChange={(event) => onStartChange(event.target.value)}
            style={styles.dateInput}
          />
        </label>
        <span style={styles.dateDash}>-</span>
        <label style={styles.dateField}>
          <span style={styles.dateLabel}>End date</span>
          <input
            type="date"
            value={endDate || ''}
            min={startDate || minDate || ''}
            max={maxDate || ''}
            disabled={disabled}
            onChange={(event) => onEndChange(event.target.value)}
            style={styles.dateInput}
          />
        </label>
      </div>
    </div>
  );
}

const styles = {
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
};
