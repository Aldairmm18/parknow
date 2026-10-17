import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Text } from '@/components/ui/Text';
import { TimeSlot } from '@/domain/models';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  slots: TimeSlot[];
  selectedSlots: TimeSlot[];
  onSlotPress: (slot: TimeSlot) => void;
  /** Umbral, en cupos, a partir del cual el bloque se marca como "quedan pocos". */
  scarcityThreshold?: number;
}

const COLUMNS = 4;

/**
 * Rejilla de bloques de 30 minutos, agrupada por franja del día.
 *
 * Agrupar importa: una lista plana de 32 bloques obliga a contar posiciones
 * para encontrar "las 3 de la tarde". Con encabezados de mañana / tarde /
 * noche se navega de un vistazo.
 */
export function TimeSlotGrid({ slots, selectedSlots, onSlotPress, scarcityThreshold = 5 }: Props) {
  const t = useTheme();
  const selectedIds = useMemo(() => new Set(selectedSlots.map((s) => s.id)), [selectedSlots]);
  const now = Date.now();

  const groups = useMemo(() => {
    const buckets: { label: string; slots: TimeSlot[] }[] = [
      { label: 'Mañana', slots: [] },
      { label: 'Tarde', slots: [] },
      { label: 'Noche', slots: [] },
    ];
    for (const slot of slots) {
      const hour = parseISO(slot.startsAt).getHours();
      buckets[hour < 12 ? 0 : hour < 18 ? 1 : 2].slots.push(slot);
    }
    return buckets.filter((b) => b.slots.length > 0);
  }, [slots]);

  return (
    <View style={{ gap: t.spacing.xl }}>
      {groups.map((group) => (
        <View key={group.label} style={{ gap: t.spacing.sm }}>
          <Text variant="overline" tone="muted">{group.label}</Text>

          <View style={styles.grid}>
            {group.slots.map((slot) => {
              const past = parseISO(slot.endsAt).getTime() <= now;
              const full = slot.availableCapacity <= 0;
              const disabled = past || full;
              const selected = selectedIds.has(slot.id);
              const scarce = !disabled && slot.availableCapacity <= scarcityThreshold;

              const background = selected
                ? t.colors.brand
                : disabled
                  ? t.colors.surfaceSunken
                  : t.colors.surface;
              const foreground = selected
                ? t.colors.textOnBrand
                : disabled
                  ? t.colors.textMuted
                  : t.colors.textPrimary;

              return (
                <Pressable
                  key={slot.id}
                  onPress={() => onSlotPress(slot)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={
                    `${format(parseISO(slot.startsAt), 'HH:mm')}, ` +
                    (past ? 'ya pasó' : full ? 'sin cupos' : `${slot.availableCapacity} cupos`)
                  }
                  style={({ pressed }) => [
                    styles.slot,
                    {
                      borderRadius: t.radius.sm,
                      backgroundColor: background,
                      borderColor: selected
                        ? t.colors.brand
                        : scarce ? t.colors.warning : t.colors.border,
                      opacity: pressed && !disabled ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text variant="caption" color={foreground}>
                    {format(parseISO(slot.startsAt), 'HH:mm')}
                  </Text>
                  <Text
                    variant="micro"
                    color={
                      selected ? t.alpha(t.palette.white, 0.8)
                        : past ? t.colors.textMuted
                        : full ? t.colors.dangerText
                        : scarce ? t.colors.warningText
                        : t.colors.textMuted
                    }
                  >
                    {past ? 'pasó' : full ? 'lleno' : `${slot.availableCapacity}`}
                  </Text>
                </Pressable>
              );
            })}

            {/* Celdas vacías para que la última fila no se estire. */}
            {Array.from({ length: (COLUMNS - (group.slots.length % COLUMNS)) % COLUMNS }).map((_, i) => (
              <View key={`filler-${i}`} style={[styles.slot, styles.filler]} pointerEvents="none" />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: {
    width: `${100 / COLUMNS}%`,
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 68,
    maxWidth: '24%',
    paddingVertical: 10,
    alignItems: 'center',
    gap: 1,
    borderWidth: 1,
  },
  // Ocupa el sitio sin dibujarse: sin color, el borde sale negro en Android.
  filler: { borderColor: 'transparent' },
});
