import { useContext } from 'react';

import { SettingsContext } from '../context';

export const useSettings = () => {
  const settingsContextValue = useContext(SettingsContext);

  if (!settingsContextValue) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }

  return settingsContextValue;
};
