import React from 'react';
import { Text as RNText, TextProps, TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/tokens';

export type TextVariant = keyof typeof typography;
type ToneKey = 'primary' | 'secondary' | 'muted' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'onBrand';

interface Props extends TextProps {
  variant?: TextVariant;
  tone?: ToneKey;
  /** Color explícito; gana sobre `tone`. */
  color?: string;
  center?: boolean;
}

export function Text({ variant = 'body', tone = 'primary', color, center, style, ...rest }: Props) {
  const { colors } = useTheme();
  const tones: Record<ToneKey, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    brand: colors.brandText,
    accent: colors.accentText,
    success: colors.successText,
    warning: colors.warningText,
    danger: colors.dangerText,
    onBrand: colors.textOnBrand,
  };
  return (
    <RNText
      {...rest}
      style={[
        typography[variant] as TextStyle,
        { color: color ?? tones[tone] },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}
