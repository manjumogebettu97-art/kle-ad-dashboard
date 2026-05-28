import React, { useState } from 'react';

export default function TooltipValue({ children, tooltip, as = 'span', valueStyle }) {
  const [open, setOpen] = useState(false);
  const Tag = as;

  if (!tooltip) {
    return <Tag style={valueStyle}>{children}</Tag>;
  }

  return (
    <span
      style={styles.wrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Tag style={valueStyle} aria-label={tooltip}>
        {children}
      </Tag>
      {open && <span style={styles.tooltip}>{tooltip}</span>}
    </span>
  );
}

const styles = {
  wrap: {
    position: 'relative',
    display: 'inline-flex',
    width: 'fit-content',
  },
  tooltip: {
    position: 'absolute',
    left: 0,
    bottom: 'calc(100% + 8px)',
    zIndex: 20,
    padding: '.38rem .55rem',
    borderRadius: 4,
    background: '#202124',
    color: '#fff',
    fontSize: '.78rem',
    fontWeight: 500,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0,0,0,.26)',
    pointerEvents: 'none',
  },
};
