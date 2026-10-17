import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette, alpha, mix } from './palette';
import {
  darkColors, elevation, lightColors, motion, radius, spacing,
  typography, ThemeColors, HIT_SLOP, MIN_TOUCH,
} from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  palette: typeof palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  motion: typeof motion;
  /** Sombra ya resuelta para el esquema activo. */
  elevation: (level: 'none' | 'sm' | 'md' | 'lg') => ReturnType<typeof elevation>;
  alpha: typeof alpha;
  mix: typeof mix;
  hitSlop: typeof HIT_SLOP;
  minTouch: number;
}

interface ThemeContextValue extends Theme {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const STORAGE_KEY = '@parknow/theme-preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPreferenceState(v);
      })
      .catch(() => {});
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme: ColorScheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(() => ({
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    palette,
    spacing,
    radius,
    typography,
    motion,
    elevation: (level) => elevation(level, scheme),
    alpha,
    mix,
    hitSlop: HIT_SLOP,
    minTouch: MIN_TOUCH,
    preference,
    setPreference,
  }), [scheme, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
