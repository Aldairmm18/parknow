import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge, Button, Card, ErrorState, Header, LoadingState, Screen, Text, BottomSpacer } from '@/components/ui';
import { ParkingLot3D } from '@/components/three/ParkingLot3D';
import { parkingService } from '@/services/parkingService';
import { FloorPlan, Spot } from '@/domain/floorPlan';
import { SpotKind, SpotStatus, VehicleType } from '@/domain/enums';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const SCENE_HEIGHT = 340;

const KIND_LABEL: Record<SpotKind, string> = {
  [SpotKind.STANDARD]: 'Estándar',
  [SpotKind.COMPACT]: 'Compacto',
  [SpotKind.MOTORCYCLE]: 'Moto',
  [SpotKind.ACCESSIBLE]: 'Accesible',
  [SpotKind.EV]: 'Carga eléctrica',
};

const KIND_ICON: Record<SpotKind, keyof typeof Ionicons.glyphMap> = {
  [SpotKind.STANDARD]: 'car-outline',
  [SpotKind.COMPACT]: 'car-sport-outline',
  [SpotKind.MOTORCYCLE]: 'bicycle-outline',
  [SpotKind.ACCESSIBLE]: 'accessibility-outline',
  [SpotKind.EV]: 'flash-outline',
};

/**
 * Elección del espacio sobre el plano 3D del parqueadero.
 *
 * Es el paso que antes no existía: la app asignaba un hueco al azar y el
 * usuario se enteraba al llegar. Aquí se ve la planta, qué está ocupado y a
 * cuántos metros queda el ascensor antes de pagar.
 */
export default function SpotsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const params = useLocalSearchParams<{
    parkingId: string;
    slotIds: string;
    startsAt: string;
    endsAt: string;
    totalPrice: string;
    vehicleType?: string;
  }>();

  const vehicleType = (params.vehicleType as VehicleType) ?? VehicleType.CAR;

  const [plans, setPlans] = useState<FloorPlan[] | null>(null);
  const [floorIndex, setFloorIndex] = useState(0);
  const [selected, setSelected] = useState<Spot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await parkingService.getFloorPlans({
        parkingLotId: params.parkingId!,
        startsAt: params.startsAt!,
        endsAt: params.endsAt!,
        vehicleType,
      });
      setPlans(result);
      // Abrir en la primera planta que tenga algo libre, no en una llena.
      const firstWithSpace = result.findIndex((p) =>
        p.spots.some((s) => s.status === SpotStatus.FREE));
      setFloorIndex(firstWithSpace >= 0 ? firstWithSpace : 0);
    } catch (e: any) {
      setError(e?.message ?? 'No pudimos cargar el plano del parqueadero.');
    }
  }, [params.parkingId, params.startsAt, params.endsAt, vehicleType]);

  useEffect(() => { load(); }, [load]);

  const plan = plans?.[floorIndex] ?? null;

  const freeCount = useMemo(
    () => plan?.spots.filter((s) => s.status === SpotStatus.FREE).length ?? 0,
    [plan],
  );

  const selectFloor = useCallback((index: number) => {
    setFloorIndex(index);
    setSelected(null);
  }, []);
  const renderFloor = useCallback(
    ({ item, index }: { item: FloorPlan; index: number }) => (
      <FloorChip p={item} index={index} active={index === floorIndex} onSelect={selectFloor} />
    ),
    [floorIndex, selectFloor],
  );

  const handleContinue = () => {
    if (!selected) return;
    const query = new URLSearchParams({
      parkingId: params.parkingId!,
      slotIds: params.slotIds!,
      startsAt: params.startsAt!,
      endsAt: params.endsAt!,
      totalPrice: params.totalPrice!,
      vehicleType,
      spotFloor: String(selected.floor),
      spotNumber: String(selected.number ?? ''),
      spotLabel: selected.label,
    });
    router.push(`/parking/payment?${query.toString()}`);
  };

  const handleAutoAssign = () => {
    if (!plans) return;
    const auto = parkingService.findFirstFree(plans, vehicleType);
    if (!auto) return;
    const index = plans.findIndex((p) => p.floor === auto.floor);
    if (index >= 0) setFloorIndex(index);
    setSelected(auto);
  };

  if (error) {
    return (
      <Screen>
        <Header title="Elige tu espacio" back />
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  if (!plans || !plan) {
    return (
      <Screen>
        <Header title="Elige tu espacio" back />
        <LoadingState label="Levantando el plano en 3D…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        overline="Paso 2 de 3"
        title="Elige tu espacio"
        subtitle={
          params.startsAt
            ? `${format(parseISO(params.startsAt), "EEE d 'de' MMM · HH:mm", { locale: es })} — ${format(parseISO(params.endsAt!), 'HH:mm')}`
            : undefined
        }
        back
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Selector de planta */}
        <FlatList
          data={plans}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p) => String(p.floor)}
          renderItem={renderFloor}
          contentContainerStyle={styles.floors}
        />

        {/* Escena 3D */}
        <Card padded={false} elevation="md" style={{ overflow: 'hidden' }}>
          <ParkingLot3D
            plan={plan}
            width={width - t.spacing.lg * 2 - 2}
            height={SCENE_HEIGHT}
            selectedSpotId={selected?.id ?? null}
            onSelectSpot={setSelected}
            autoRotate={!selected}
          />
        </Card>

        <View style={[styles.legend, { gap: t.spacing.md }]}>
          <LegendItem color={t.scheme === 'dark' ? t.palette.mint[700] : t.palette.mint[300]} label="Libre" />
          <LegendItem color={t.scheme === 'dark' ? '#3A3D48' : t.palette.neutral[400]} label="Ocupado" />
          <LegendItem color={t.palette.amber[400]} label="Fuera de servicio" />
          <LegendItem color={t.colors.brand} label="Tu elección" />
        </View>

        {/* Detalle del espacio elegido */}
        {selected ? (
          <Card selected elevation="md" style={{ gap: t.spacing.md }}>
            <View style={[styles.between, { alignItems: 'center' }]}>
              <View style={[styles.row, { gap: t.spacing.md }]}>
                <View style={[styles.spotBadge, { backgroundColor: t.colors.brand, borderRadius: t.radius.md }]}>
                  <Text variant="bodyStrong" color={t.colors.textOnBrand}>{selected.label}</Text>
                </View>
                <View style={{ gap: 2 }}>
                  <Text variant="bodyStrong">{plan.label}</Text>
                  <Text variant="micro" tone="muted">Espacio {selected.number}</Text>
                </View>
              </View>
              <Badge label={KIND_LABEL[selected.kind]} tone="brand" icon={KIND_ICON[selected.kind]} />
            </View>

            <View style={[styles.detailRow, { gap: t.spacing.lg, borderTopColor: t.colors.border, paddingTop: t.spacing.md }]}>
              <Detail icon="walk-outline" value={`${selected.walkToExit} m`} label="al ascensor" />
              <Detail
                icon="resize-outline"
                value={`${selected.width.toFixed(1)} × ${selected.depth.toFixed(1)} m`}
                label="medidas"
              />
            </View>
          </Card>
        ) : (
          <Card tone="sunken" elevation="none" style={[styles.row, { gap: t.spacing.md }]}>
            <Ionicons name="hand-left-outline" size={20} color={t.colors.textMuted} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              Gira el plano con el dedo y toca un espacio verde para elegirlo.
              {freeCount === 0 ? ' En esta planta no queda ninguno libre.' : ''}
            </Text>
          </Card>
        )}
        <BottomSpacer extra={120 - t.spacing.md} />
      </ScrollView>

      {/* Barra de acción */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + t.spacing.md,
            backgroundColor: t.colors.surface,
            borderTopColor: t.colors.border,
            gap: t.spacing.sm,
          },
          t.elevation('lg'),
        ]}
      >
        <View style={[styles.between, { alignItems: 'center' }]}>
          <View>
            <Text variant="micro" tone="muted">Total</Text>
            <Text variant="heading">
              ${Number(params.totalPrice ?? 0).toLocaleString('es-CO')}
              <Text variant="micro" tone="muted"> COP</Text>
            </Text>
          </View>
          <Pressable onPress={handleAutoAssign} hitSlop={t.hitSlop}>
            <Text variant="caption" tone="brand">Elegir por mí</Text>
          </Pressable>
        </View>

        <Button
          label={selected ? `Continuar con ${selected.label}` : 'Elige un espacio en el plano'}
          icon="arrow-forward"
          iconRight
          disabled={!selected}
          onPress={handleContinue}
          size="lg"
        />
      </View>
    </Screen>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.row, { gap: 5 }]}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text variant="micro" tone="secondary">{label}</Text>
    </View>
  );
}

function Detail({ icon, value, label }: { icon: any; value: string; label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { gap: 6, flex: 1 }]}>
      <Ionicons name={icon} size={16} color={t.colors.textMuted} />
      <View>
        <Text variant="caption">{value}</Text>
        <Text variant="micro" tone="muted">{label}</Text>
      </View>
    </View>
  );
}

const FloorChip = React.memo(function FloorChip({ p, index, active, onSelect }: {
  p: FloorPlan;
  index: number;
  active: boolean;
  onSelect: (index: number) => void;
}) {
  const t = useTheme();
  const press = useCallback(() => onSelect(index), [onSelect, index]);
              const free = p.spots.filter((s) => s.status === SpotStatus.FREE).length;
  return (
    <Pressable
      onPress={press}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.floorChip,
        {
          borderRadius: t.radius.md,
          backgroundColor: active ? t.colors.brand : t.colors.surface,
          borderColor: active ? t.colors.brand : t.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text variant="caption" color={active ? t.colors.textOnBrand : t.colors.textPrimary}>
        {p.label}
      </Text>
      <Text
        variant="micro"
        color={active ? t.alpha(t.palette.white, 0.75) : free > 0 ? t.colors.successText : t.colors.dangerText}
      >
        {free > 0 ? `${free} libres` : 'sin cupo'}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  floors:  { gap: spacing.sm },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  floorChip: { paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, alignItems: 'center', gap: 1, minWidth: 96 },
  legend:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  row:       { flexDirection: 'row', alignItems: 'center' },
  between:   { flexDirection: 'row', justifyContent: 'space-between' },
  spotBadge: { minWidth: 52, height: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  detailRow: { flexDirection: 'row', borderTopWidth: 1 },
  footer:    { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
