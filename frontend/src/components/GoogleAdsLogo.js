import React from 'react';

// Brand mark for the dashboard — a stylized 4-color analytics chart icon.
// (Renders next to the dashboard title; the colors echo the Google Ads palette since
// the underlying data is sourced from Google Ads exports.)
export default function BrandMark({
  size = 36,
  withText = false,
  primaryText = 'KLE Academy',
  secondaryText = 'NIRF Campaign Dashboard',
  textColor = '#202124',
  palette = ['#1A73E8', '#D93025', '#F9AB00', '#188038'],
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Dashboard"
      >
        <rect x="0" y="0" width="40" height="40" rx="9" fill="#FFFFFF" stroke="#E8EAED" />
        <rect x="8"  y="22" width="4" height="12" rx="1.5" fill={palette[0]} />
        <rect x="15" y="16" width="4" height="18" rx="1.5" fill={palette[1]} />
        <rect x="22" y="10" width="4" height="24" rx="1.5" fill={palette[2]} />
        <rect x="29" y="6"  width="4" height="28" rx="1.5" fill={palette[3]} />
      </svg>
      {withText && (
        <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontWeight: 600, fontSize: '.95rem', color: textColor, letterSpacing: '.01em' }}>
            {primaryText}
          </span>
          <span style={{ fontSize: '.72rem', color: textColor === '#202124' ? '#5F6368' : 'rgba(255,255,255,.75)' }}>
            {secondaryText}
          </span>
        </span>
      )}
    </span>
  );
}
