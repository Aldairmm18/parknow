import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Coloca el icono después del texto (flechas de "continuar"). */
  iconRight?: boolean;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Retroalimentación háptica al pulsar. Activada por defecto en primarios. */
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const HEIGHTS: Record<Size, number> = { sm: 38, md: 48, lg: 56 };

export function Button({
  label, onPress, variant = 'primary', size = 'md', icon, iconRight,
  loading, disabled, fullWidth = true, haptic, style, testID,
}: Props) {
  const t = useTheme();
  const isDisabled = disabled || loading;
  const height = HEIGHTS[size];

  const surfaces: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary:   { bg: t.colors.brand,      fg: t.colors.textOnBrand },
    secondary: { bg: t.colors.surfaceSunken, fg: t.colors.textPrimary },
    ghost:     { bg: 'transparent',       fg: t.colors.brandText },
    danger:    { bg: t.colors.dangerSoft, fg: t.colors.dangerText, border: t.colors.danger },
    outline:   { bg: 'transparent',       fg: t.colors.textPrimary, border: t.colors.borderStrong },
  };
  const s = surfaces[variant];

  const handlePress = () => {
    if (isDisabled) return;
    if (haptic ?? variant === 'primary') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  const content = (
    <View style={styles.row}>
      {loading ? (
        <ActivityIndicator color={s.fg} size="small" />
      ) : (
        <>
          {icon && !iconRight && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={s.fg} />}
          <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} color={s.fg}>{label}</Text>
          {icon && iconRight && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={s.fg} />}
        </>
      )}
    </View>
  );

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          borderRadius: t.radius.md,
          width: fullWidth ? '100%' : undefined,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? t.spacing.md : t.spacing.xl,
          backgroundColor: variant === 'primary' ? 'transparent' : s.bg,
          borderWidth: s.border ? 1 : 0,
          borderColor: s.border,
          opacity: isDisabled ? 0.45 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
        variant === 'primary' && !isDisabled && t.elevation('md'),
        style,
      ]}
    >
      {variant === 'primary' ? (
        // El degradado da profundidad sin recurrir a sombras duras: el mismo
        // tono en dos luminosidades, no dos colores distintos.
        <LinearGradient
          colors={[t.palette.brand[500], t.palette.brand[700]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: t.radius.md }]}
        />
      ) : null}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
