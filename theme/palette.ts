/**
 * Rampas de color generadas en OKLCH y convertidas a sRGB con recorte de gamut
 * por reducción de croma (el tono y la luminosidad se conservan exactos).
 *
 * Todas las rampas comparten la misma escalera de luminosidad, así que el paso
 * 600 de `brand` y el 600 de `rose` se perciben igual de oscuros. Eso es lo que
 * hace que la interfaz se sienta como un solo sistema y no como colores sueltos.
 *
 * Los neutros llevan croma 0.014 en el mismo tono de marca: grises "teñidos"
 * que armonizan con el violeta en lugar de pelearse con él.
 *
 * Contraste verificado (WCAG 2.1): todos los pares texto/fondo usados en la app
 * superan 4.5:1. Ver `docs/DESIGN_SYSTEM.md`.
 */

export const palette = {
  /** Indigo-violeta eléctrico — identidad y acciones primarias. hue 274 */
  brand: {
    50: '#F2F5FF', 100: '#E3E9FF', 200: '#CDD7FF', 300: '#ADBCFF',
    400: '#879AFF', 500: '#6878FD', 600: '#5561E1', 700: '#4550BC',
    800: '#363F93', 900: '#28306E', 950: '#171C46',
  },
  /** Cian — navegación, rutas y acciones secundarias. hue 196 */
  accent: {
    50: '#E2FCFB', 100: '#C6F4F4', 200: '#9EE9E9', 300: '#63D5D6',
    400: '#00BABB', 500: '#009C9E', 600: '#008485', 700: '#006D6F',
    800: '#005657', 900: '#004142', 950: '#002728',
  },
  /** Verde menta — disponible / éxito. hue 163 */
  mint: {
    50: '#E7FBF1', 100: '#D0F4E1', 200: '#AFE8CC', 300: '#82D5AE',
    400: '#49BB8C', 500: '#00A271', 600: '#00895F', 700: '#00714E',
    800: '#00593C', 900: '#00432D', 950: '#002919',
  },
  /** Ámbar — atención / casi lleno. hue 76 */
  amber: {
    50: '#FFF4E4', 100: '#FDE6C6', 200: '#F7D3A0', 300: '#E9B76D',
    400: '#D3952B', 500: '#B67C00', 600: '#9A6800', 700: '#805600',
    800: '#654300', 900: '#4D3200', 950: '#2F1D00',
  },
  /** Rojo rosado — error / lleno. hue 22 */
  rose: {
    50: '#FFF2F1', 100: '#FFE2E0', 200: '#FFCAC7', 300: '#FFA4A1',
    400: '#F87374', 500: '#E34E53', 600: '#C73640', 700: '#A72B33',
    800: '#822328', 900: '#621C1F', 950: '#3E0E10',
  },
  /** Grises teñidos con el tono de marca. hue 274, croma 0.014 */
  neutral: {
    50: '#F5F5F7', 100: '#E9EAED', 200: '#D7D9DE', 300: '#BEC0C7',
    400: '#A0A2AB', 500: '#868892', 600: '#71737C', 700: '#5D5F66',
    800: '#494A50', 900: '#37383C', 950: '#202124',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const;

/** Convierte `#RRGGBB` + alfa 0–1 a `rgba(...)`, para overlays y estados. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Mezcla dos colores en sRGB. Se usa para el sombreado de las caras 3D:
 * `mix(base, '#FFFFFF', 0.3)` ilumina, `mix(base, '#000000', 0.3)` oscurece.
 */
export function mix(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const c = (a: number, b: number) =>
    Math.round(a + (b - a) * Math.min(1, Math.max(0, t))).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`.toUpperCase();
}
