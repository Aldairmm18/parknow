import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, ErrorState, LoadingState, Text } from '@/components/ui';
import { ParkingMarker } from '@/components/map/ParkingMarker';
import { parkingService } from '@/services/parkingService';
import { ParkingLotWithAvailability } from '@/domain/models';
import { useUserLocation } from '@/hooks/useUserLocation';
import { formatDistance, regionForPoints } from '@/lib/geo';
import { darkMapStyle, lightMapStyle } from '@/theme/mapStyle';
import { MapUnavailable } from '@/components/map/MapUnavailable';
import { mapsAvailable } from '@/lib/maps';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const CARD_WIDTH = Dimensions.get('window').width * 0.82;
const CARD_GAP = 12;
/** Distancia entre el inicio de una tarjeta y la siguiente: el paso del carrusel. */
const CARD_STRIDE = CARD_WIDTH + CARD_GAP;

/**
 * Mapa con todos los parqueaderos.
 *
 * El carrusel inferior y las chinchetas están sincronizados en ambos sentidos:
 * tocar un marcador desplaza el carrusel, y deslizar el carrusel recentra el
 * mapa. Es el patrón con el que la gente ya sabe leer un mapa de sitios.
 */
export default function MapaScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { location, permission, request: requestLocation } = useUserLocation();

  const mapRef = useRef<MapView | null>(null);
  const listRef = useRef<FlatList<ParkingLotWithAvailability> | null>(null);

  const [lots, setLots] = useState<ParkingLotWithAvailability[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLots(await parkingService.getAllWithAvailability(location));
    } catch (e: any) {
      setError(e?.message ?? 'No pudimos cargar el mapa.');
    }
  }, [location]);

  useEffect(() => { load(); }, [load]);

  const mappable = useMemo(
    () => (lots ?? []).filter((l) => l.latitude != null && l.longitude != null),
    [lots],
  );

  const initialRegion = useMemo(() => {
    const points = mappable.map((l) => ({ latitude: l.latitude!, longitude: l.longitude! }));
    if (location) points.push(location);
    return regionForPoints(points);
  }, [mappable, location]);

  const focusLot = useCallback((lot: ParkingLotWithAvailability, scrollList: boolean) => {
    setSelectedId(lot.id);
    mapRef.current?.animateToRegion({
      latitude: lot.latitude!,
      longitude: lot.longitude!,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 400);

    if (scrollList) {
      const index = mappable.findIndex((l) => l.id === lot.id);
      if (index >= 0) listRef.current?.scrollToOffset({ offset: index * CARD_STRIDE, animated: true });
    }
  }, [mappable]);

  const recenterOnUser = () => {
    if (!location) { requestLocation(); return; }
    mapRef.current?.animateToRegion({
      ...location, latitudeDelta: 0.02, longitudeDelta: 0.02,
    }, 400);
  };

  const openLot = useCallback(
    (lot: ParkingLotWithAvailability) => router.push(`/parking/${lot.id}`),
    [router],
  );
  const navigateToLot = useCallback(
    (lot: ParkingLotWithAvailability) => router.push(`/parking/navigate?parkingId=${lot.id}`),
    [router],
  );
  const renderLot = useCallback(
    ({ item }: { item: ParkingLotWithAvailability }) => (
      <MapLotCard
        lot={item}
        selected={item.id === selectedId}
        onOpen={openLot}
        onNavigate={navigateToLot}
      />
    ),
    [selectedId, openLot, navigateToLot],
  );

  if (error) {
    return (
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (!lots) {
    return (
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <LoadingState label="Cargando el mapa…" />
      </View>
    );
  }

  if (!mapsAvailable) return <MapUnavailable lots={lots} />;

  return (
    <View style={styles.root}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />

      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // Google Maps en Android; en iOS, Apple Maps por defecto, que no
        // necesita clave de API ni aparece con marca de agua.
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        customMapStyle={t.scheme === 'dark' ? darkMapStyle : lightMapStyle}
        showsUserLocation={permission === 'granted'}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onPress={() => setSelectedId(null)}
      >
        {mappable.map((lot) => (
          <ParkingMarker
            key={lot.id}
            parking={lot}
            selected={lot.id === selectedId}
            onPress={() => focusLot(lot, true)}
          />
        ))}
      </MapView>

      <View style={[styles.topBar, { top: insets.top + t.spacing.md, gap: t.spacing.sm }]} pointerEvents="box-none">
        <Card elevation="md" padded={false} style={[styles.legend, { gap: t.spacing.md, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm }]}>
          <LegendDot color={t.colors.success} label="Con cupo" />
          <LegendDot color={t.colors.warning} label="Casi lleno" />
          <LegendDot color={t.colors.danger} label="Lleno" />
        </Card>
      </View>

      <Pressable
        onPress={recenterOnUser}
        accessibilityRole="button"
        accessibilityLabel="Centrar en mi ubicación"
        style={({ pressed }) => [
          styles.locateBtn,
          {
            bottom: insets.bottom + 210,
            backgroundColor: t.colors.surface,
            borderColor: t.colors.border,
            borderRadius: t.radius.md,
            opacity: pressed ? 0.75 : 1,
          },
          t.elevation('md'),
        ]}
      >
        <Ionicons
          name={permission === 'granted' ? 'locate' : 'locate-outline'}
          size={20}
          color={permission === 'granted' ? t.colors.brand : t.colors.textSecondary}
        />
      </Pressable>

      <FlatList
        ref={listRef}
        data={mappable}
        keyExtractor={(lot) => lot.id}
        renderItem={renderLot}
        getItemLayout={(_, index) => ({ length: CARD_STRIDE, offset: CARD_STRIDE * index, index })}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_STRIDE}
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
        // El área segura va en la posición, no en el padding del contenido.
        style={[styles.carousel, { bottom: insets.bottom }]}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / CARD_STRIDE);
          const lot = mappable[index];
          if (lot) focusLot(lot, false);
        }}
      />
    </View>
  );
}

/** Tarjeta del carrusel. Recibe el parqueadero en los manejadores para que la lista no cree funciones por fila. */
const MapLotCard = React.memo(function MapLotCard({ lot, selected, onOpen, onNavigate }: {
  lot: ParkingLotWithAvailability;
  selected: boolean;
  onOpen: (lot: ParkingLotWithAvailability) => void;
  onNavigate: (lot: ParkingLotWithAvailability) => void;
}) {
  const t = useTheme();
  const open = useCallback(() => onOpen(lot), [onOpen, lot]);
  const navigate = useCallback(() => onNavigate(lot), [onNavigate, lot]);
  return (
    <Card
      elevation="lg"
      selected={selected}
      style={{ width: CARD_WIDTH, gap: t.spacing.sm }}
    >
      <View style={[styles.between, { alignItems: 'flex-start', gap: t.spacing.sm }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{lot.name}</Text>
          <Text variant="micro" tone="muted" numberOfLines={1}>{lot.address}</Text>
        </View>
        <Badge
          label={lot.availableSlots > 0 ? `${lot.availableSlots} libres` : 'Lleno'}
          tone={lot.availableSlots > 0 ? 'success' : 'danger'}
          dot
        />
      </View>

      <View style={[styles.metaRow, { gap: t.spacing.lg }]}>
        <Meta icon="cash-outline" value={`$${lot.pricePerBlock.toLocaleString('es-CO')}`} label="/ 30 min" />
        {lot.distanceMeters != null ? (
          <Meta icon="navigate-outline" value={formatDistance(lot.distanceMeters)} label="de ti" />
        ) : null}
      </View>

      <View style={[styles.actions, { gap: t.spacing.sm }]}>
        <Button
          label="Ver detalle"
          variant="secondary"
          size="sm"
          onPress={open}
          style={{ flex: 1 }}
        />
        <Button
          label="Cómo llegar"
          icon="navigate"
          size="sm"
          onPress={navigate}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
});

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.metaRow, { gap: 5 }]}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="micro" tone="secondary">{label}</Text>
    </View>
  );
}

function Meta({ icon, value, label }: { icon: any; value: string; label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.metaRow, { gap: 5 }]}>
      <Ionicons name={icon} size={14} color={t.colors.textMuted} />
      <Text variant="caption">{value}</Text>
      <Text variant="micro" tone="muted">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  topBar:    { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  legend:    { flexDirection: 'row', alignItems: 'center' },
  locateBtn: { position: 'absolute', right: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  carousel:  { position: 'absolute', bottom: 0, left: 0, right: 0 },
  carouselContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: CARD_GAP },
  between:   { flexDirection: 'row', justifyContent: 'space-between' },
  metaRow:   { flexDirection: 'row', alignItems: 'center' },
  actions:   { flexDirection: 'row' },
});
