import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge, Card, EmptyState, ErrorState, Field, Header,
  ParkingCardSkeleton, Screen, Text, BottomSpacer,
} from '@/components/ui';
import { ParkingCard } from '@/components/ParkingCard';
import { parkingService } from '@/services/parkingService';
import { reservationService } from '@/services/reservationService';
import { authService } from '@/services/authService';
import { ParkingLotWithAvailability, Reservation } from '@/domain/models';
import { ReservationStatus } from '@/domain/enums';
import { useUserLocation } from '@/hooks/useUserLocation';
import { formatDistance } from '@/lib/geo';
import { floorLabelFor, spotLabelFor } from '@/domain/floorPlan';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { format, parseISO } from 'date-fns';

type Sort = 'distance' | 'price' | 'availability';

/** Filtra por nombre o dirección y ordena según el criterio elegido. */
function filterAndSort(lots: ParkingLotWithAvailability[], query: string, sort: Sort) {
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? lots.filter((l) => l.name.toLowerCase().includes(needle) || l.address.toLowerCase().includes(needle))
    : lots;

  const sorted = [...filtered];
  if (sort === 'price') sorted.sort((a, b) => a.pricePerBlock - b.pricePerBlock);
  else if (sort === 'availability') sorted.sort((a, b) => b.availableSlots - a.availableSlots);
  else sorted.sort((a, b) =>
    (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY));
  return sorted;
}

/** Parqueaderos, nombre del usuario y su reserva en curso. */
function useHomeData(location: ReturnType<typeof useUserLocation>['location']) {
  const [firstName, setFirstName] = useState('');
  const [lots, setLots] = useState<ParkingLotWithAvailability[] | null>(null);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, user] = await Promise.all([
        parkingService.getAllWithAvailability(location),
        authService.currentUser(),
      ]);
      setLots(data);
      setFirstName(user?.fullName?.trim().split(' ')[0] ?? '');

      if (user) {
        const reservations = await reservationService.getMine();
        setActiveReservation(
          reservations.find((r) =>
            r.status === ReservationStatus.RESERVED || r.status === ReservationStatus.CHECKED_IN,
          ) ?? null,
        );
      }
    } catch (e: any) {
      setError(e?.message ?? 'No pudimos cargar los parqueaderos.');
    }
  }, [location]);

  useEffect(() => { load(); }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { firstName, lots, activeReservation, error, refreshing, load, refresh };
}

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { location, permission, request: requestLocation } = useUserLocation();
  const { firstName, lots, activeReservation, error, refreshing, load, refresh } = useHomeData(location);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('distance');

  const visible = useMemo(() => (lots ? filterAndSort(lots, query, sort) : []), [lots, query, sort]);

  const openParking = useCallback(
    (p: ParkingLotWithAvailability) => router.push(`/parking/${p.id}`),
    [router],
  );
  const navigateToParking = useCallback(
    (p: ParkingLotWithAvailability) => router.push(`/parking/navigate?parkingId=${p.id}`),
    [router],
  );
  const renderParking = useCallback(
    ({ item }: { item: ParkingLotWithAvailability }) => (
      <ParkingCard parking={item} onPress={openParking} onNavigate={navigateToParking} />
    ),
    [openParking, navigateToParking],
  );

  return (
    <Screen>
      <Header
        overline={greeting()}
        title={firstName ? `Hola, ${firstName}` : 'Buscar parqueadero'}
        subtitle="Elige tu espacio antes de salir de casa"
        right={<ScanButton onPress={() => router.push('/parking/scanner')} />}
      >
        <Field
          icon="search-outline"
          value={query}
          onChangeText={setQuery}
          placeholder="Nombre o dirección"
          accessibilityLabel="Buscar parqueadero"
          returnKeyType="search"
          trailing={query.length > 0 ? <ClearButton onPress={() => setQuery('')} /> : undefined}
        />
      </Header>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderParking}
        contentContainerStyle={styles.content}
        ListFooterComponent={<BottomSpacer extra={t.spacing['4xl'] - t.spacing.md} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={t.colors.brand}
            colors={[t.colors.brand]}
          />
        }
        ListHeaderComponent={
          <HomeListHeader
            lots={lots}
            activeReservation={activeReservation}
            showLocationPrompt={permission !== 'granted'}
            onEnableLocation={requestLocation}
            sort={sort}
            onSort={setSort}
          />
        }
        ListEmptyComponent={
          <HomeEmpty error={error} loading={!lots} query={query} onRetry={load} onClear={() => setQuery('')} />
        }
      />
    </Screen>
  );
}

function ScanButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Escanear código QR"
      hitSlop={t.hitSlop}
      style={({ pressed }) => [
        styles.scanBtn,
        {
          backgroundColor: t.colors.brandSoft,
          borderColor: t.colors.brand,
          borderRadius: t.radius.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name="qr-code-outline" size={20} color={t.colors.brand} />
    </Pressable>
  );
}

function ClearButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Ionicons name="close-circle" size={18} color={t.colors.textMuted} onPress={onPress} suppressHighlighting />
  );
}

/** Reserva en curso, aviso de ubicación, cifras y orden: todo lo que va sobre la lista. */
function HomeListHeader({ lots, activeReservation, showLocationPrompt, onEnableLocation, sort, onSort }: {
  lots: ParkingLotWithAvailability[] | null;
  activeReservation: Reservation | null;
  showLocationPrompt: boolean;
  onEnableLocation: () => void;
  sort: Sort;
  onSort: (sort: Sort) => void;
}) {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.listHeader, { gap: t.spacing.md }]}>
      {activeReservation ? (
        <ActiveReservationCard
          reservation={activeReservation}
          onPress={() => router.push(`/parking/confirmation?reservationId=${activeReservation.id}`)}
        />
      ) : null}

      {showLocationPrompt ? <LocationPrompt onEnable={onEnableLocation} /> : null}

      {lots ? <HomeStats lots={lots} /> : null}

      <View style={[styles.sortRow, { gap: t.spacing.xs }]}>
        <SortChip active={sort === 'distance'} label="Más cerca" onPress={() => onSort('distance')} />
        <SortChip active={sort === 'availability'} label="Más cupos" onPress={() => onSort('availability')} />
        <SortChip active={sort === 'price'} label="Más barato" onPress={() => onSort('price')} />
      </View>
    </View>
  );
}

function HomeStats({ lots }: { lots: ParkingLotWithAvailability[] }) {
  const t = useTheme();
  const withSpace = lots.filter((l) => l.availableSlots > 0).length;
  const nearest = lots.find((l) => l.distanceMeters != null);
  return (
    <View style={[styles.stats, { gap: t.spacing.sm }]}>
      <StatTile icon="business-outline" value={String(lots.length)} label="parqueaderos" />
      <StatTile icon="checkmark-circle-outline" value={String(withSpace)} label="con cupo" tone="success" />
      <StatTile
        icon="navigate-outline"
        value={nearest?.distanceMeters != null ? formatDistance(nearest.distanceMeters) : '—'}
        label="el más cerca"
        tone="accent"
      />
    </View>
  );
}

function HomeEmpty({ error, loading, query, onRetry, onClear }: {
  error: string | null;
  loading: boolean;
  query: string;
  onRetry: () => void;
  onClear: () => void;
}) {
  const t = useTheme();
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading) {
    return (
      <View style={{ gap: t.spacing.md }}>
        <ParkingCardSkeleton />
        <ParkingCardSkeleton />
        <ParkingCardSkeleton />
      </View>
    );
  }
  return (
    <EmptyState
      icon="search-outline"
      title={query ? 'Sin resultados' : 'Aún no hay parqueaderos'}
      message={query ? `No encontramos nada para "${query}".` : 'Vuelve a intentarlo en unos minutos.'}
      actionLabel={query ? 'Limpiar búsqueda' : undefined}
      onAction={query ? onClear : undefined}
    />
  );
}

/** Banda superior con la reserva en curso: lo más urgente, siempre visible. */
function ActiveReservationCard({ reservation, onPress }: { reservation: Reservation; onPress: () => void }) {
  const t = useTheme();
  const checkedIn = reservation.status === ReservationStatus.CHECKED_IN;

  return (
    <Card onPress={onPress} tone="brand" elevation="md" style={{ gap: t.spacing.sm }}>
      <View style={[styles.between, { alignItems: 'center' }]}>
        <Badge
          label={checkedIn ? 'Estás dentro' : 'Reserva activa'}
          tone={checkedIn ? 'success' : 'brand'}
          dot
        />
        <Ionicons name="chevron-forward" size={18} color={t.colors.brandText} />
      </View>

      <Text variant="heading">
        {format(parseISO(reservation.startsAt), 'HH:mm')} — {format(parseISO(reservation.endsAt), 'HH:mm')}
      </Text>

      <View style={[styles.metaRow, { gap: t.spacing.md }]}>
        {reservation.assignedFloor != null ? (
          <View style={[styles.metaRow, { gap: 4 }]}>
            <Ionicons name="layers-outline" size={13} color={t.colors.brandText} />
            <Text variant="caption" tone="brand">
              {floorLabelFor(reservation.assignedFloor)} · {spotLabelFor(reservation.assignedSpot ?? 0)}
            </Text>
          </View>
        ) : null}
        {reservation.vehiclePlate ? (
          <View style={[styles.metaRow, { gap: 4 }]}>
            <Ionicons name="car-outline" size={13} color={t.colors.textSecondary} />
            <Text variant="caption" tone="secondary">{reservation.vehiclePlate}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function LocationPrompt({ onEnable }: { onEnable: () => void }) {
  const t = useTheme();
  return (
    <Card onPress={onEnable} tone="sunken" elevation="none" style={[styles.row, { gap: t.spacing.md }]}>
      <View style={[styles.icon, { backgroundColor: t.colors.accentSoft, borderRadius: t.radius.md }]}>
        <Ionicons name="location-outline" size={20} color={t.colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong">Activa tu ubicación</Text>
        <Text variant="micro" tone="secondary">
          Para ordenar los parqueaderos por cercanía y trazar la ruta.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
    </Card>
  );
}

function StatTile({ icon, value, label, tone }: {
  icon: any; value: string; label: string; tone?: 'success' | 'accent';
}) {
  const t = useTheme();
  const color = tone === 'success' ? t.colors.successText : tone === 'accent' ? t.colors.accentText : t.colors.textPrimary;
  return (
    <Card elevation="none" padded={false} style={{ flex: 1, paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.sm, alignItems: 'center', gap: 2 }}>
      <Ionicons name={icon} size={16} color={color} />
      <Text variant="bodyStrong" color={color} numberOfLines={1}>{value}</Text>
      <Text variant="micro" tone="muted" numberOfLines={1}>{label}</Text>
    </Card>
  );
}

function SortChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: t.radius.pill,
          backgroundColor: active ? t.colors.brand : t.colors.surface,
          borderColor: active ? t.colors.brand : t.colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text variant="micro" color={active ? t.colors.textOnBrand : t.colors.textSecondary}>
        {label}
      </Text>
    </Pressable>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const styles = StyleSheet.create({
  listHeader: { paddingBottom: spacing.xs },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  scanBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stats:   { flexDirection: 'row' },
  sortRow: { flexDirection: 'row' },
  chip:    { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1 },
  row:     { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  icon:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
