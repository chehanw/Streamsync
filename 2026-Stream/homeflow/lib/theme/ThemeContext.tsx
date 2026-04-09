/**
 * App-wide theme context with Light / Dark / System appearance switching.
 * Persists preference to AsyncStorage.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppearanceMode = 'system' | 'light' | 'dark';

export interface ThemeColors {
  background: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  separator: string;
  accent: string;
  secondaryFill: string;
  semanticSuccess: string;
  semanticWarning: string;
  semanticError: string;
}

export interface AppTheme {
  isDark: boolean;
  colors: ThemeColors;
}

interface ThemeContextValue {
  theme: AppTheme;
  appearance: AppearanceMode;
  setAppearance: (mode: AppearanceMode) => void;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

const lightColors: ThemeColors = {
  background: '#F2F2F7',        // systemGroupedBackground
  card: '#FFFFFF',               // secondarySystemGroupedBackground
  textPrimary: '#000000',        // label
  textSecondary: '#3C3C43',      // secondaryLabel
  textTertiary: '#3C3C4399',     // tertiaryLabel
  separator: '#3C3C4333',        // separator
  accent: '#2E7CF6',             // warmed systemBlue — less electric
  secondaryFill: '#78788033',    // secondarySystemFill
  semanticSuccess: '#34C759',    // systemGreen
  semanticWarning: '#FF9500',    // systemOrange
  semanticError: '#FF3B30',      // systemRed
};

const darkColors: ThemeColors = {
  background: '#000000',         // systemGroupedBackground (dark)
  card: '#1C1C1E',               // secondarySystemGroupedBackground (dark)
  textPrimary: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textTertiary: '#EBEBF599',
  separator: '#54545899',
  accent: '#5E9EFF',             // warmed systemBlue — softer
  secondaryFill: '#78788052',
  semanticSuccess: '#30D158',    // systemGreen
  semanticWarning: '#FF9F0A',    // systemOrange
  semanticError: '#FF453A',      // systemRed
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const STORAGE_KEY = '@homeflow_appearance';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [appearance, setAppearanceState] = useState<AppearanceMode>('system');
  const [loaded, setLoaded] = useState(false);

  // Load persisted preference
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (!cancelled && (value === 'light' || value === 'dark' || value === 'system')) {
        setAppearanceState(value);
      }
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const setAppearance = useCallback((mode: AppearanceMode) => {
    setAppearanceState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const resolvedIsDark = useMemo(() => {
    if (appearance === 'system') return systemScheme === 'dark';
    return appearance === 'dark';
  }, [appearance, systemScheme]);

  const theme: AppTheme = useMemo(() => ({
    isDark: resolvedIsDark,
    colors: resolvedIsDark ? darkColors : lightColors,
  }), [resolvedIsDark]);

  const value = useMemo(() => ({
    theme,
    appearance,
    setAppearance,
  }), [theme, appearance, setAppearance]);

  // Don't render until preference is loaded to avoid flash
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return ctx;
}
