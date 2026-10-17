import React from 'react';
import { ActivityIndicator, Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

/** Bloque gris que late mientras se cargan datos reales. */
export function Skeleton({ height = 16, width, radius, style }: {
  height?: number; width?: number | `${number}%`; radius?: number; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const [pulse] = React.useState(() => new Animated.Value(0.4));

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          height,
          width: width ?? '100%',
          borderRadius: radius ?? t.radius.sm,
          backgroundColor: t.colors.surfaceSunken,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/** Tarjeta fantasma con la misma silueta que `ParkingCard`. */
export function ParkingCardSkeleton() {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.colors.border,
        padding: t.spacing.lg,
        gap: t.spacing.md,
      }}
    >
      <View style={styles.row}>
        <Skeleton height={44} width={44} radius={t.radius.md} style={{ flexGrow: 0 }} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton height={14} width="70%" />
          <Skeleton height={11} width="45%" />
        </View>
      </View>
      <Skeleton height={6} radius={3} />
      <View style={styles.row}>
        <Skeleton height={26} width="30%" radius={t.radius.sm} />
        <Skeleton height={26} width="30%" radius={t.radius.sm} />
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, message, actionLabel, onAction }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.center, { padding: t.spacing['3xl'], gap: t.spacing.sm }]}>
      <View
        style={{
          width: 72, height: 72, borderRadius: t.radius.xl,
          backgroundColor: t.colors.surfaceSunken,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: t.spacing.xs,
        }}
      >
        <Ionicons name={icon} size={32} color={t.colors.textMuted} />
      </View>
      <Text variant="heading" center>{title}</Text>
      {message ? <Text variant="caption" tone="secondary" center>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          variant="secondary"
          fullWidth={false}
          style={{ marginTop: t.spacing.md }}
        />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.center, { padding: t.spacing['3xl'], gap: t.spacing.sm }]}>
      <View
        style={{
          width: 72, height: 72, borderRadius: t.radius.xl,
          backgroundColor: t.colors.dangerSoft,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="cloud-offline-outline" size={32} color={t.colors.danger} />
      </View>
      <Text variant="heading" center>Algo salió mal</Text>
      <Text variant="caption" tone="secondary" center>{message}</Text>
      {onRetry ? (
        <Button
          label="Reintentar"
          icon="refresh"
          onPress={onRetry}
          variant="secondary"
          fullWidth={false}
          style={{ marginTop: t.spacing.md }}
        />
      ) : null}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.center, { gap: t.spacing.md, padding: t.spacing['3xl'] }]}>
      <ActivityIndicator size="large" color={t.colors.brand} />
      {label ? <Text variant="caption" tone="secondary">{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
