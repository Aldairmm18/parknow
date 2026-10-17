import { Platform, TextStyle, ViewStyle } from 'react-native';
import { alpha, palette } from './palette';

/**
 * Tokens semánticos. Las pantallas nunca deben leer `palette` directamente:
 * piden `colors.textPrimary`, no `neutral.900`. Así el tema claro y el oscuro
 * comparten exactamente los mismos nombres y cambiar uno no rompe el otro.
 */
export interface ThemeColors {
  /** Fondo de la pantalla. */
  background: string;
  /** Fondo elevado un nivel (tarjetas, hojas). */
  surface: string;
  /** Superficie hundida (inputs, tracks, chips apagados). */
  surfaceSunken: string;
  /** Superficie con tinte de marca (banners, iconos). */
  surfaceBrand: string;
  /** Superficie del lienzo 3D y de los mapas en modo oscuro. */
  canvas: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Texto sobre `brand` / `accent` sólidos. */
  textOnBrand: string;

  border: string;
  /** Borde más marcado, para el foco y los elementos seleccionados. */
  borderStrong: string;

  brand: string;
  brandStrong: string;
  brandSoft: string;
  brandText: string;

  accent: string;
  accentSoft: string;
  accentText: string;

  success: string;
  successSoft: string;
  successText: string;

  warning: string;
  warningSoft: string;
  warningText: string;

  danger: string;
  dangerSoft: string;
  dangerText: string;

  /** Velo para modales y hojas. */
  scrim: string;
  /** Barra de estado: 'light' o 'dark'. */
  statusBar: 'light' | 'dark';
}

export const lightColors: ThemeColors = {
  background:    palette.neutral[50],
  surface:       palette.white,
  surfaceSunken: palette.neutral[100],
  surfaceBrand:  palette.brand[50],
  canvas:        palette.brand[50],

  textPrimary:   palette.neutral[900],
  textSecondary: palette.neutral[600],
  textMuted:     palette.neutral[500],
  textOnBrand:   palette.white,

  border:        palette.neutral[200],
  borderStrong:  palette.neutral[300],

  brand:         palette.brand[600],
  brandStrong:   palette.brand[700],
  brandSoft:     palette.brand[50],
  brandText:     palette.brand[700],

  accent:        palette.accent[600],
  accentSoft:    palette.accent[50],
  accentText:    palette.accent[700],

  success:       palette.mint[600],
  successSoft:   palette.mint[50],
  successText:   palette.mint[700],

  warning:       palette.amber[600],
  warningSoft:   palette.amber[50],
  warningText:   palette.amber[700],

  danger:        palette.rose[600],
  dangerSoft:    palette.rose[50],
  dangerText:    palette.rose[700],

  scrim:         alpha(palette.neutral[950], 0.45),
  statusBar:     'dark',
};

export const darkColors: ThemeColors = {
  background:    '#141518',
  surface:       '#1D1E22',
  surfaceSunken: '#26272C',
  surfaceBrand:  '#22243A',
  canvas:        '#141518',

  textPrimary:   palette.neutral[100],
  textSecondary: palette.neutral[400],
  textMuted:     palette.neutral[500],
  textOnBrand:   palette.white,

  border:        '#2E3036',
  borderStrong:  '#3D3F47',

  brand:         palette.brand[500],
  brandStrong:   palette.brand[400],
  brandSoft:     '#22243A',
  brandText:     palette.brand[300],

  accent:        palette.accent[400],
  accentSoft:    '#0E2B2C',
  accentText:    palette.accent[300],

  success:       palette.mint[400],
  successSoft:   '#0C2A20',
  successText:   palette.mint[300],

  warning:       palette.amber[400],
  warningSoft:   '#2C2008',
  warningText:   palette.amber[300],

  danger:        palette.rose[400],
  dangerSoft:    '#33171A',
  dangerText:    palette.rose[300],

  scrim:         alpha(palette.black, 0.6),
  statusBar:     'light',
};

/** Escala de espaciado de 4 pt. Nada de números sueltos en las pantallas. */
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 56,
} as const;

/** Radios. `pill` se usa para chips y badges; `full` para avatares. */
export const radius = {
  xs: 6, sm: 10, md: 14, lg: 18, xl: 24, '2xl': 32, pill: 999, full: 9999,
} as const;

/**
 * Tipografía: una sola familia, siete tamaños. El contraste se consigue con
 * peso y color, no con más tamaños — es lo que mantiene la pantalla tranquila.
 */
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.8 },
  title:   { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '700', letterSpacing: -0.2 },
  body:    { fontSize: 15, lineHeight: 22, fontWeight: '500', letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '700', letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500', letterSpacing: 0 },
  micro:   { fontSize: 11, lineHeight: 15, fontWeight: '600', letterSpacing: 0.2 },
  /** Etiquetas de sección en versalitas. */
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  /** Cifras alineadas para precios, horas y placas. */
  numeric: {
    fontSize: 22, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextStyle>;

type Elevation = 'none' | 'sm' | 'md' | 'lg';

/**
 * Sombras suaves y de un solo tono. En modo oscuro la elevación se comunica
 * con el color de la superficie, no con sombras (que ahí no se ven).
 */
export function elevation(level: Elevation, scheme: 'light' | 'dark'): ViewStyle {
  if (level === 'none' || scheme === 'dark') return {};
  const map = {
    sm: { h: 1, blur: 3,  opacity: 0.05, elev: 1 },
    md: { h: 4, blur: 12, opacity: 0.07, elev: 3 },
    lg: { h: 10, blur: 28, opacity: 0.10, elev: 8 },
  }[level];
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: palette.neutral[950],
      shadowOffset: { width: 0, height: map.h },
      shadowOpacity: map.opacity,
      shadowRadius: map.blur,
    },
    android: { elevation: map.elev },
    default: {},
  })!;
}

/** Duraciones de animación, en ms. */
export const motion = { fast: 140, base: 220, slow: 380, lazy: 700 } as const;

/** Altura mínima táctil recomendada por las guías de accesibilidad. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
export const MIN_TOUCH = 44;
