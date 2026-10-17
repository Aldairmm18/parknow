import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

interface Props {
  title: string;
  /** Línea en versalitas encima del título. */
  overline?: string;
  subtitle?: string;
  /** Muestra el botón de volver. Por defecto, sí en pantallas apiladas. */
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Contenido extra debajo del título (buscador, selector de días…). */
  children?: React.ReactNode;
  /** Sin fondo teñido: encabezado plano sobre el fondo de la pantalla. */
  flat?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Encabezado único para toda la app. Antes cada pantalla repetía su propio
 * bloque "hero" con paddings y radios ligeramente distintos; esto unifica el
 * ritmo vertical y el tratamiento del botón de volver.
 */
export function Header({
  title, overline, subtitle, back, onBack, right, children, flat, style,
}: Props) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          paddingTop: insets.top + t.spacing.md,
          paddingHorizontal: t.spacing.xl,
          paddingBottom: children ? t.spacing.lg : t.spacing.xl,
          backgroundColor: flat ? 'transparent' : t.colors.background,
        },
        style,
      ]}
    >
      <View style={styles.topRow}>
        {back ? (
          <Pressable
            onPress={onBack ?? (() => router.back())}
            hitSlop={t.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={({ pressed }) => [
              styles.backBtn,
              {
                backgroundColor: t.colors.surface,
                borderColor: t.colors.border,
                borderRadius: t.radius.sm,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={t.colors.textPrimary} />
          </Pressable>
        ) : <View />}
        {right}
      </View>

      <View style={{ marginTop: back || right ? t.spacing.lg : 0 }}>
        {overline ? <Text variant="overline" tone="brand">{overline}</Text> : null}
        <Text variant="title" style={{ marginTop: overline ? 4 : 0 }}>{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>{subtitle}</Text>
        ) : null}
      </View>

      {children ? <View style={{ marginTop: t.spacing.lg }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
