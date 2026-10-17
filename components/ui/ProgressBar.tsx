import React, { useEffect, useState } from 'react';
import { Animated, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  /** 0–1. */
  value: number;
  color?: string;
  track?: string;
  height?: number;
  /** Anima el cambio de valor (útil para el avance de la ruta). */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ value, color, track, height = 6, animated = true, style }: Props) {
  const t = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const [anim] = useState(() => new Animated.Value(clamped));

  useEffect(() => {
    if (!animated) { anim.setValue(clamped); return; }
    Animated.timing(anim, {
      toValue: clamped,
      duration: t.motion.slow,
      useNativeDriver: false,
    }).start();
  }, [clamped, animated, anim, t.motion.slow]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        { height, borderRadius: height / 2, backgroundColor: track ?? t.colors.surfaceSunken, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color ?? t.colors.brand,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

/**
 * Color semántico para un porcentaje de ocupación. Centralizado aquí para que
 * la barra de una tarjeta y la de una pantalla de detalle nunca discrepen.
 */
export function useOccupancyTone(occupancyPercent: number) {
  const t = useTheme();
  if (occupancyPercent >= 90) return { color: t.colors.danger, label: 'Casi lleno', tone: 'danger' as const };
  if (occupancyPercent >= 65) return { color: t.colors.warning, label: 'Concurrido', tone: 'warning' as const };
  return { color: t.colors.success, label: 'Disponible', tone: 'success' as const };
}
