import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addDays, format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, EmptyState, ErrorState, Header, LoadingState, Screen, Text, BottomSpacer } from '@/components/ui';
import { TimeSlotGrid } from '@/components/TimeSlotGrid';
import { parkingService } from '@/services/parkingService';
import { TimeSlot } from '@/domain/models';
import { VehicleType } from '@/domain/enums';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const DAYS_AHEAD = 7;
/** Bloques seguidos que como máximo se pueden reservar de una vez (6 horas). */
const MAX_BLOCKS = 12;

/**
 * Selección de día y bloques horarios.
 *
 * Los bloques deben ser **contiguos**: una reserva es un intervalo continuo de
 * ocupación de un espacio físico, no una colección de huecos sueltos.
 */
export default function AvailabilityScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { parkingId, vehicleType: vehicleParam } = useLocalSearchParams<{
    parkingId: string; vehicleType?: string;
  }>();

  const [vehicleType, setVehicleType] = useState<VehicleType>(
    (vehicleParam as VehicleType) ?? VehicleType.CAR,
  );
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<TimeSlot[]>([]);
  const [slots, setSlots] = useState<TimeSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(startOfDay(new Date()), i)),
    [],
  );

  const load = useCallback(async () => {
    setSlots(null);
    setError(null);
    setSelected([]);
    try {
      setSlots(await parkingService.getTimeSlots(parkingId!, format(selectedDate, 'yyyy-MM-dd')));
    } catch (e: any) {
      setError(e?.message ?? 'No pudimos cargar los horarios.');
    }
  }, [parkingId, selectedDate]);

  useEffect(() => { load(); }, [load]);

  const renderDay = useCallback(
    ({ item }: { item: Date }) => (
      <DayChip day={item} active={isSameDay(item, selectedDate)} onSelect={setSelectedDate} />
    ),
    [selectedDate],
  );

  const handleSlotPress = (slot: TimeSlot) => {
    setNotice(null);

    // Tocar uno ya elegido lo quita, y con él todo lo que quede suelto.
    if (selected.some((s) => s.id === slot.id)) {
      setSelected(longestContiguousRun(selected.filter((s) => s.id !== slot.id)));
      return;
    }

    if (selected.length >= MAX_BLOCKS) {
      setNotice(`Puedes reservar hasta ${MAX_BLOCKS / 2} horas seguidas.`);
      return;
    }

    const merged = [...selected, slot].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    // Empezar de cero es lo que la gente espera al tocar un bloque lejano.
    setSelected(isContiguous(merged) ? merged : [slot]);
  };

  const totalPrice = selected.reduce((sum, s) => sum + (s.pricePerBlock ?? 0), 0);
  const minutes = selected.length * 30;

  const handleContinue = () => {
    if (selected.length === 0) return;
    const query = new URLSearchParams({
      parkingId: parkingId!,
      slotIds: selected.map((s) => s.id).join(','),
      startsAt: selected[0].startsAt,
      endsAt: selected[selected.length - 1].endsAt,
      totalPrice: String(totalPrice),
      vehicleType,
    });
    router.push(`/parking/spots?${query.toString()}`);
  };

  return (
    <Screen>
      <Header overline="Paso 1 de 3" title="Elige tu horario" back>
        <FlatList
          data={days}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(day) => day.toISOString()}
          renderItem={renderDay}
          contentContainerStyle={styles.days}
        />
      </Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.row, { gap: t.spacing.sm }]}>
          <VehicleChip
            label="Carro"
            icon="car"
            active={vehicleType === VehicleType.CAR}
            onPress={() => setVehicleType(VehicleType.CAR)}
          />
          <VehicleChip
            label="Moto"
            icon="bicycle"
            active={vehicleType === VehicleType.MOTORCYCLE}
            onPress={() => setVehicleType(VehicleType.MOTORCYCLE)}
          />
        </View>

        {notice ? (
          <Card tone="sunken" elevation="none" style={[styles.row, { gap: t.spacing.sm }]}>
            <Ionicons name="information-circle-outline" size={17} color={t.colors.warning} />
            <Text variant="micro" tone="secondary" style={{ flex: 1 }}>{notice}</Text>
          </Card>
        ) : null}

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !slots ? (
          <LoadingState label="Buscando horarios disponibles…" />
        ) : slots.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="Sin horarios ese día"
            message="Prueba con otra fecha."
          />
        ) : (
          <TimeSlotGrid slots={slots} selectedSlots={selected} onSlotPress={handleSlotPress} />
        )}
        <BottomSpacer extra={(selected.length > 0 ? 160 : 40) - t.spacing.lg} />
      </ScrollView>

      {selected.length > 0 ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + t.spacing.md,
              backgroundColor: t.colors.surface,
              borderTopColor: t.colors.border,
              gap: t.spacing.md,
            },
            t.elevation('lg'),
          ]}
        >
          <View style={[styles.between, { alignItems: 'center' }]}>
            <View style={{ gap: 3 }}>
              <Badge
                label={`${format(parseISO(selected[0].startsAt), 'HH:mm')} — ${format(parseISO(selected[selected.length - 1].endsAt), 'HH:mm')}`}
                tone="brand"
                icon="time-outline"
              />
              <Text variant="micro" tone="muted">
                {selected.length} bloque{selected.length > 1 ? 's' : ''} · {minutes} min
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="micro" tone="muted">Total</Text>
              <Text variant="heading">${totalPrice.toLocaleString('es-CO')}</Text>
            </View>
          </View>

          <Button label="Elegir espacio" icon="arrow-forward" iconRight onPress={handleContinue} size="lg" />
        </View>
      ) : null}
    </Screen>
  );
}

function VehicleChip({ label, icon, active, onPress }: {
  label: string; icon: any; active: boolean; onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.vehicleChip,
        {
          borderRadius: t.radius.md,
          backgroundColor: active ? t.colors.brandSoft : t.colors.surface,
          borderColor: active ? t.colors.brand : t.colors.border,
          borderWidth: active ? 1.5 : 1,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={active ? t.colors.brand : t.colors.textMuted} />
      <Text variant="caption" tone={active ? 'brand' : 'secondary'}>{label}</Text>
    </Pressable>
  );
}

/** ¿Los bloques van uno detrás de otro sin huecos? */
function isContiguous(slots: TimeSlot[]): boolean {
  for (let i = 0; i < slots.length - 1; i++) {
    if (parseISO(slots[i].endsAt).getTime() !== parseISO(slots[i + 1].startsAt).getTime()) {
      return false;
    }
  }
  return true;
}

/** Tramo continuo más largo; se usa al deseleccionar uno del medio. */
function longestContiguousRun(slots: TimeSlot[]): TimeSlot[] {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  let best: TimeSlot[] = [sorted[0]];
  let run: TimeSlot[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const continues =
      parseISO(sorted[i - 1].endsAt).getTime() === parseISO(sorted[i].startsAt).getTime();
    run = continues ? [...run, sorted[i]] : [sorted[i]];
    if (run.length > best.length) best = run;
  }
  return best;
}

const DayChip = React.memo(function DayChip({ day, active, onSelect }: {
  day: Date;
  active: boolean;
  onSelect: (day: Date) => void;
}) {
  const t = useTheme();
  const press = useCallback(() => onSelect(day), [onSelect, day]);
              const today = isSameDay(day, new Date());
  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={format(day, "EEEE d 'de' MMMM", { locale: es })}
      style={({ pressed }) => [
        styles.day,
        {
          borderRadius: t.radius.md,
          backgroundColor: active ? t.colors.brand : t.colors.surface,
          borderColor: active ? t.colors.brand : t.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        variant="micro"
        color={active ? t.alpha(t.palette.white, 0.8) : t.colors.textMuted}
        style={{ textTransform: 'capitalize' }}
      >
        {today ? 'Hoy' : format(day, 'EEE', { locale: es })}
      </Text>
      <Text variant="bodyStrong" color={active ? t.colors.textOnBrand : t.colors.textPrimary}>
        {format(day, 'd')}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  days:    { gap: spacing.sm },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  day:         { width: 56, paddingVertical: 10, alignItems: 'center', gap: 1, borderWidth: 1 },
  row:         { flexDirection: 'row', alignItems: 'center' },
  vehicleChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 10 },
  between:     { flexDirection: 'row', justifyContent: 'space-between' },
  footer:      { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
