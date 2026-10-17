import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge, Button, Card, ErrorState, Header, LoadingState,
  ProgressBar, Screen, Text, useOccupancyTone, BottomSpacer,
} from '@/components/ui';
import { ParkingLot3D } from '@/components/three/ParkingLot3D';
import { parkingService } from '@/services/parkingService';
import { navigationService } from '@/services/navigationService';
import { ParkingLotWithAvailability } from '@/domain/models';
import { FloorPlan } from '@/domain/floorPlan';
import { useUserLocation } from '@/hooks/useUserLocation';
import { formatDistance } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const AMENITY_LABELS: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  cubierto:   { label: 'Cubierto', icon: 'umbrella-outline' },
  vigilancia: { label: 'Vigilancia 24/7', icon: 'shield-checkmark-outline' },
  camaras:    { label: 'Cámaras', icon: 'videocam-outline' },
  carga_ev:   { label: 'Carga eléctrica', icon: 'flash-outline' },
  lavado:     { label: 'Lavado', icon: 'water-outline' },
  accesible:  { label: 'Accesible', icon: 'accessibility-outline' },
  ascensor:   { label: 'Ascensor', icon: 'swap-vertical-outline' },
};

/** Carga el parqueadero y su plano con la ocupación de las próximas dos horas. */
function useParkingDetail(id: string | undefined) {
  const { location } = useUserLocation();
  const [lot, setLot] = useState<ParkingLotWithAvailability | null>(null);
  const [plans, setPlans] = useState<FloorPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const found = await parkingService.getByIdWithAvailability(id!, location);
      if (!found) throw new Error('Este parqueadero ya no está disponible.');
      setLot(found);

      // Vista previa del plano con la ocupación de las próximas dos horas.
      const now = new Date();
      const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      setPlans(await parkingService.getFloorPlans({
        parkingLotId: found.id,
        startsAt: now.toISOString(),
        endsAt: in2h.toISOString(),
      }));
    } catch (e: any) {
      setError(e?.message ?? 'No pudimos cargar el parqueadero.');
    }
  }, [id, location]);

  useEffect(() => { load(); }, [load]);

  return { lot, plans, error, load };
}

/** Abre la app de mapas del sistema con el parqueadero como destino. */
function openInMaps(lot: ParkingLotWithAvailability) {
  if (lot.latitude == null || lot.longitude == null) return;
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const url = navigationService.externalNavigationUrl(
    { latitude: lot.latitude, longitude: lot.longitude }, lot.name, platform,
  );
  Linking.openURL(url).catch(() => {});
}

export default function ParkingDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { lot, plans, error, load } = useParkingDetail(id);

  const occupancy = useOccupancyTone(lot?.occupancyPercent ?? 0);
  const amenities = useMemo(
    () => (lot?.amenities ?? []).map((key) => AMENITY_LABELS[key]).filter(Boolean),
    [lot],
  );

  if (error) {
    return (
      <Screen>
        <Header title="Parqueadero" back />
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  if (!lot) {
    return (
      <Screen>
        <Header title="Parqueadero" back />
        <LoadingState />
      </Screen>
    );
  }

  const available = lot.availableSlots > 0;

  return (
    <Screen>
      <Header
        overline="Parqueadero"
        title={lot.name}
        subtitle={lot.address}
        back
        right={
          <Badge
            label={available ? `${lot.availableSlots} libres` : 'Sin cupos'}
            tone={available ? 'success' : 'danger'}
            dot
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {plans?.length ? <FloorPreview plans={plans} /> : null}

        {/* Ocupación */}
        <Card style={{ gap: t.spacing.sm }}>
          <View style={styles.between}>
            <Text variant="caption" tone="secondary">Ocupación ahora</Text>
            <Text variant="bodyStrong" color={occupancy.color}>
              {lot.occupancyPercent}% · {occupancy.label}
            </Text>
          </View>
          <ProgressBar value={lot.occupancyPercent / 100} color={occupancy.color} />
        </Card>

        {/* Cifras */}
        <View style={[styles.row, { gap: t.spacing.sm }]}>
          <Stat icon="car-outline" value={String(lot.carCapacity)} label="carros" />
          <Stat icon="bicycle-outline" value={String(lot.motoCapacity)} label="motos" />
          <Stat
            icon="cash-outline"
            value={`$${lot.pricePerBlock.toLocaleString('es-CO')}`}
            label="/ 30 min"
            highlight
          />
        </View>

        {lot.latitude != null ? <LocationCard lot={lot} /> : null}

        {/* Servicios */}
        {amenities.length > 0 ? (
          <Card style={{ gap: t.spacing.md }}>
            <Text variant="overline" tone="muted">Servicios</Text>
            <View style={[styles.amenities, { gap: t.spacing.sm }]}>
              {amenities.map((a) => (
                <Badge key={a.label} label={a.label} icon={a.icon} tone="accent" />
              ))}
            </View>
          </Card>
        ) : null}

        {/* Horario */}
        {lot.opensAt && lot.closesAt ? (
          <Card style={[styles.row, { gap: t.spacing.md }]}>
            <Ionicons name="time-outline" size={18} color={t.colors.textMuted} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              Abierto de {lot.opensAt} a {lot.closesAt}
            </Text>
          </Card>
        ) : null}
        <BottomSpacer extra={120 - t.spacing.md} />
      </ScrollView>

      <DetailFooter lot={lot} />
    </Screen>
  );
}

/** Vista 3D del plano con selector de planta cuando hay más de una. */
function FloorPreview({ plans }: { plans: FloorPlan[] }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const [floorIndex, setFloorIndex] = useState(0);
  const plan = plans[floorIndex] ?? plans[0];
  return (
    <Card padded={false} elevation="md" style={styles.clip}>
      <ParkingLot3D plan={plan} width={width - t.spacing.lg * 2 - 2} height={240} autoRotate minimalControls />
      {plans.length > 1 ? (
        <View style={[styles.floorBar, { borderTopColor: t.colors.border, gap: t.spacing.xs }]}>
          {plans.map((p, index) => (
            <Text
              key={p.floor}
              variant="micro"
              tone={index === floorIndex ? 'brand' : 'muted'}
              onPress={() => setFloorIndex(index)}
              suppressHighlighting
              style={styles.floorTab}
            >
              {p.label}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function LocationCard({ lot }: { lot: ParkingLotWithAvailability }) {
  const t = useTheme();
  return (
    <Card onPress={() => openInMaps(lot)} style={[styles.row, { gap: t.spacing.md }]}>
      <View style={[styles.icon, { backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md }]}>
        <Ionicons name="location" size={20} color={t.colors.accent} />
      </View>
      <View style={styles.cardText}>
        <Text variant="bodyStrong">
          {lot.distanceMeters != null ? `A ${formatDistance(lot.distanceMeters)} de ti` : 'Ver ubicación'}
        </Text>
        <Text variant="micro" tone="muted" numberOfLines={1}>{lot.address}</Text>
      </View>
      <Ionicons name="open-outline" size={18} color={t.colors.textMuted} />
    </Card>
  );
}

/** Barra fija inferior con las dos acciones principales. */
function DetailFooter({ lot }: { lot: ParkingLotWithAvailability }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const available = lot.availableSlots > 0;
  return (
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
      <Button
        label={available ? 'Reservar espacio' : 'Sin disponibilidad ahora'}
        icon={available ? 'calendar-outline' : 'close-circle-outline'}
        disabled={!available}
        onPress={() => router.push(`/parking/availability?parkingId=${lot.id}`)}
        size="lg"
      />
      {lot.latitude != null ? (
        <Button
          label="Cómo llegar"
          icon="navigate"
          variant="secondary"
          onPress={() => router.push(`/parking/navigate?parkingId=${lot.id}`)}
        />
      ) : null}
    </View>
  );
}

function Stat({ icon, value, label, highlight }: {
  icon: any; value: string; label: string; highlight?: boolean;
}) {
  const t = useTheme();
  return (
    <Card
      tone={highlight ? 'brand' : 'surface'}
      elevation="none"
      style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: t.spacing.lg }}
    >
      <Ionicons name={icon} size={19} color={highlight ? t.colors.brand : t.colors.textMuted} />
      <Text variant="bodyStrong" tone={highlight ? 'brand' : 'primary'} numberOfLines={1}>{value}</Text>
      <Text variant="micro" tone="muted">{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  clip:     { overflow: 'hidden' },
  floorTab: { paddingHorizontal: 10, paddingVertical: 6 },
  cardText: { flex: 1, gap: 2 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  row:       { flexDirection: 'row', alignItems: 'center' },
  between:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon:      { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  amenities: { flexDirection: 'row', flexWrap: 'wrap' },
  floorBar:  { flexDirection: 'row', justifyContent: 'center', borderTopWidth: 1, paddingVertical: 2 },
  footer:    { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
