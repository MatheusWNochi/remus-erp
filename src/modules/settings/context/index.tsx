import { createContext } from 'react';
import { SettingsContextValue } from '../types';

export const SettingsContext = createContext<SettingsContextValue | null>(null);
