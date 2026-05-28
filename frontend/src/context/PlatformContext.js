import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const PLATFORM_THEMES = {
  google: {
    name: 'Google Ads',
    primary: '#1A73E8',
    primaryHover: '#1557B0',
    primaryLight: '#E8F0FE',
    secondary: '#D93025',
    tertiary: '#F9AB00',
    success: '#188038',
    background: '#F1F3F4',
    logo: ['#1A73E8', '#D93025', '#F9AB00', '#188038'],
    kpis: ['#1A73E8', '#D93025', '#F9AB00', '#188038', '#34A853'],
  },
  linkedin: {
    name: 'LinkedIn Ads',
    primary: '#0A66C2',
    primaryHover: '#004182',
    primaryLight: '#E1EEF7',
    secondary: '#378FE9',
    tertiary: '#057642',
    success: '#057642',
    background: '#F3F6F8',
    logo: ['#0A66C2', '#378FE9', '#057642', '#004182'],
    kpis: ['#0A66C2', '#378FE9', '#057642', '#004182', '#5E9FDB'],
  },
};

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const [platform, setPlatformState] = useState(() => {
    const saved = localStorage.getItem('selectedPlatform');
    return PLATFORM_THEMES[saved] ? saved : 'google';
  });
  const [selectedAdTypes, setSelectedAdTypes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('selectedAdTypes')) || {};
    } catch (_) {
      return {};
    }
  });

  const setPlatform = useCallback((nextPlatform) => {
    if (!PLATFORM_THEMES[nextPlatform]) return;
    localStorage.setItem('selectedPlatform', nextPlatform);
    setPlatformState(nextPlatform);
  }, []);

  const setSelectedAdType = useCallback((targetPlatform, subPlatform) => {
    if (!targetPlatform || !subPlatform) return;
    setSelectedAdTypes((current) => {
      const next = { ...current, [targetPlatform]: subPlatform };
      localStorage.setItem('selectedAdTypes', JSON.stringify(next));
      return next;
    });
  }, []);

  const theme = PLATFORM_THEMES[platform];
  const selectedAdType = selectedAdTypes[platform] || '';
  const cssVars = useMemo(() => ({
    '--brand-primary': theme.primary,
    '--brand-primary-hover': theme.primaryHover,
    '--brand-primary-light': theme.primaryLight,
    '--brand-secondary': theme.secondary,
    '--brand-tertiary': theme.tertiary,
    '--brand-success': theme.success,
    '--app-background': theme.background,
  }), [theme]);

  return (
    <PlatformContext.Provider value={{ platform, setPlatform, selectedAdType, setSelectedAdType, theme, cssVars }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be inside PlatformProvider');
  return ctx;
}
