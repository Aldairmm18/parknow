import React from 'react';
import { Pressable, StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface Props extends ViewProps {
  onPress?: () => void;
  /** `flat` quita la sombra; `raised` la acentúa. */
  elevation?: 'none' | 'sm' | 'md' | 'lg';
  padded?: boolean;
  /** Resalta la tarjeta con el borde de marca (selección). */
  selected?: boolean;
  tone?: 'surface' | 'sunken' | 'brand';
  style?: StyleProp<ViewStyle>;
}

export function Card({
  onPress, elevation = 'sm', padded = true, selected, tone = 'surface', style, children, ...rest
}: Props) {
  const t = useTheme();
  const backgrounds = {
    surface: t.colors.surface,
    sunken: t.colors.surfaceSunken,
    brand: t.colors.surfaceBrand,
  };

  const base: ViewStyle = {
    backgroundColor: backgrounds[tone],
    borderRadius: t.radius.lg,
    borderWidth: 1,
    borderColor: selected ? t.colors.brand : t.colors.border,
    padding: padded ? t.spacing.lg : 0,
    ...(selected ? { borderWidth: 1.5 } : null),
  };

  if (!onPress) {
    return (
      <View {...rest} style={[base, t.elevation(elevation), style]}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        base,
        t.elevation(elevation),
        pressed && { opacity: 0.94, transform: [{ scale: 0.995 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
