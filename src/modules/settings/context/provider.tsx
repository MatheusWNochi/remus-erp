'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { SettingsContext } from '.';
import { NavPosition, SettingsContextValue } from '../types';

const NAV_POSITION_KEY = 'settings.navPosition';
const SIDEBAR_COLLAPSED_KEY = 'settings.sidebarCollapsed';

type SettingsProviderProps = {
  children: React.ReactNode;
};

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [navPosition, setNavPositionState] = useState<NavPosition>('top');
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);

  useEffect(() => {
    const storedNavPosition = window.localStorage.getItem(NAV_POSITION_KEY);
    const storedSidebarCollapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);

    // Synced from localStorage on mount to avoid an SSR hydration mismatch.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (storedNavPosition === 'top' || storedNavPosition === 'side') {
      setNavPositionState(storedNavPosition);
    }
    if (storedSidebarCollapsed === 'true') {
      setSidebarCollapsedState(true);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setNavPosition = useCallback((position: NavPosition) => {
    setNavPositionState(position);
    window.localStorage.setItem(NAV_POSITION_KEY, position);
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, []);

  const value: SettingsContextValue = useMemo(
    () => ({ navPosition, setNavPosition, sidebarCollapsed, setSidebarCollapsed }),
    [navPosition, setNavPosition, sidebarCollapsed, setSidebarCollapsed]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
