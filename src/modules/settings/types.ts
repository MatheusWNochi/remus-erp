export type NavPosition = 'top' | 'side';

export type SettingsContextValue = {
  navPosition: NavPosition;
  setNavPosition: (position: NavPosition) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
};
