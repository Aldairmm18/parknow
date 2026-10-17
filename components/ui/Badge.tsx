import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger';

interface Props {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Punto de color en vez de icono: útil para estados "en vivo". */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'neutral', icon, dot, style }: Props) {
  const t = useTheme();
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: t.colors.surfaceSunken, fg: t.colors.textSecondary },
    brand:   { bg: t.colors.brandSoft,     fg: t.colors.brandText },
    accent:  { bg: t.colors.accentSoft,    fg: t.colors.accentText },
    success: { bg: t.colors.successSoft,   fg: t.colors.successText },
    warning: { bg: t.colors.warningSoft,   fg: t.colors.warningText },
    danger:  { bg: t.colors.dangerSoft,    fg: t.colors.dangerText },
  };
  const c = map[tone];

  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderRadius: t.radius.pill }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: c.fg }]} />}
      {icon && !dot && <Ionicons name={icon} size={12} color={c.fg} />}
      <Text variant="micro" color={c.fg}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, alignSelf: 'flex-start' },
  dot:   { width: 6, height: 6, borderRadius: 3 },
});
