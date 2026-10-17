import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { differenceInMinutes, parseISO } from 'date-fns';
import { Badge, Button, Card, ErrorState, LoadingState, ProgressBar, Text } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { parkingService } from '@/services/parkingService';
import { reservationRepository } from '@/repositories/reservationRepository';
import { ParkingLot, Reservation } from '@/domain/models';
import { TravelMode, TripStatus, VehicleType } from '@/domain/enums';
import { useTripTracker } from '@/hooks/useTripTracker';
import { formatDistance, formatDuration, formatEta, LatLng, regionForPoints } from '@/lib/geo';
import { navigationService } from '@/services/navigationService';
import { darkMapStyle, lightMapStyle } from '@/theme/mapStyle';
import { mapsAvailable } from '@/lib/maps';
import { useTheme } from '@/theme/ThemeProvider';

type Trip = ReturnType<typeof useTripTracker>;

/** Carga el parqueadero de destino, directo o a través de la reserva. */
function useNavigationTarget(parkingId?: string, reservationId?: string) {
  const [lot, setLot] = useState<ParkingLot | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // Si el usuario sale antes de que termine la carga, no tocar el estado.
    let cancelled = false;
    (async () => {
      try {
        let lotId = parkingId;
        if (reservationId) {
          const res = await reservationRepository.getById(reservationId);
          if (cancelled) return;
          setReservation(res);
          lotId = res?.parkingLotId ?? lotId;
        }
        if (!lotId) throw new Error('No sabemos a qué parqueadero ir.');
        const found = await parkingService.getById(lotId);
        if (!found) throw new Error('Parqueadero no encontrado.');
        if (found.latitude == null || found.longitude == null) {
          throw new Error('Este parqueadero no tiene ubicación registrada.');
        }
        if (!cancelled) setLot(found);
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? 'No pudimos preparar la ruta.');
      }
    })();
    return () => { cancelled = true; };
  }, [parkingId, reservationId]);

  const destination = useMemo<LatLng | null>(
    () => (lot?.latitude != null && lot?.longitude != null
      ? { latitude: lot.latitude, longitude: lot.longitude }
      : null),
    [lot],
  );

  return { lot, reservation, destination, loadError };
}

/** Minutos de margen = minutos hasta el límite de llegada menos los que falta conducir. */
function arrivalSlack(reservation: Reservation | null, remainingSeconds: number): number | null {
  if (!reservation?.arrivalDeadlineAt) return null;
  const deadlineMinutes = differenceInMinutes(parseISO(reservation.arrivalDeadlineAt), new Date());
  return deadlineMinutes - Math.ceil(remainingSeconds / 60);
}

function slackTone(slack: number): BadgeTone {
  if (slack < 0) return 'danger';
  return slack < 8 ? 'warning' : 'success';
}

function openExternalNavigation(destination: LatLng, name: string) {
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  Linking.openURL(navigationService.externalNavigationUrl(destination, name, platform)).catch(() => {
    Linking.openURL(navigationService.externalNavigationUrl(destination, name, 'web'));
  });
}

/**
 * Seguimiento de la ruta hasta el parqueadero.
 *
 * Tres cosas compiten por la atención y hay que ordenarlas: la indicación
 * inmediata (qué hago ahora), el tiempo que falta y —si hay reserva— cuánto
 * margen queda antes de que expire. El margen gana cuando se pone en rojo.
 */
export default function NavigateScreen() {
  const t = useTheme();
  const router = useRouter();
  const { parkingId, reservationId } = useLocalSearchParams<{
    parkingId?: string; reservationId?: string;
  }>();
  const { lot, reservation, destination, loadError } = useNavigationTarget(parkingId, reservationId);

  if (loadError) {
    return (
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <ErrorState message={loadError} onRetry={() => router.back()} />
      </View>
    );
  }

  if (!lot || !destination) {
    return (
      <View style={[styles.root, { backgroundColor: t.colors.background }]}>
        <LoadingState label="Preparando la ruta…" />
      </View>
    );
  }

  return (
    <TripView
      lot={lot}
      destination={destination}
      reservation={reservation}
      onBack={() => router.back()}
      onArrived={() =>
        reservation
          ? router.replace(`/parking/confirmation?reservationId=${reservation.id}`)
          : router.replace(`/parking/${lot.id}`)}
    />
  );
}

/**
 * El seguimiento vive en su propio componente porque `useTripTracker` necesita
 * un destino definido; montarlo sólo cuando lo hay evita llamar al hook de
 * forma condicional.
 */
function TripView({ lot, destination, reservation, onBack, onArrived }: {
  lot: ParkingLot;
  destination: LatLng;
  reservation: Reservation | null;
  onBack: () => void;
  onArrived: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [showSteps, setShowSteps] = useState(false);

  const mode = reservation?.vehicleType === VehicleType.MOTORCYCLE ? TravelMode.MOTORCYCLE : TravelMode.DRIVING;
  const trip = useTripTracker({ destination, mode });

  // Encuadre automático mientras el usuario no toque el mapa.
  useEffect(() => {
    if (!followUser || !trip.location || !mapRef.current) return;
    mapRef.current.animateToRegion(regionForPoints([trip.location, destination], 0.6), 600);
  }, [trip.location, followUser, destination]);

  const arrived = trip.status === TripStatus.ARRIVED;

  return (
    <View style={styles.root}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />

      <TripMap mapRef={mapRef} trip={trip} lot={lot} destination={destination} onPanDrag={() => setFollowUser(false)} />

      {/* Cabecera flotante */}
      <View style={[styles.header, { top: insets.top + t.spacing.sm, gap: t.spacing.sm }]} pointerEvents="box-none">
        <RoundButton icon="chevron-back" label="Volver" onPress={onBack} />
        {trip.currentStep && !arrived ? <StepBanner trip={trip} /> : <View style={styles.flex} />}
      </View>

      <RouteStatusBadge trip={trip} top={insets.top + 78} />

      <RecenterButton
        active={followUser}
        bottom={insets.bottom + (showSteps ? 360 : 260)}
        onPress={() => setFollowUser(true)}
      />

      {/* Panel inferior */}
      <Card
        elevation="lg"
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + t.spacing.lg, gap: t.spacing.md, borderColor: t.colors.border },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: t.colors.borderStrong }]} />
        <TripSheetBody
          trip={trip}
          lot={lot}
          destination={destination}
          reservation={reservation}
          arrived={arrived}
          showSteps={showSteps}
          onToggleSteps={() => setShowSteps((v) => !v)}
          onArrived={onArrived}
        />
      </Card>
    </View>
  );
}

function TripMap({ mapRef, trip, lot, destination, onPanDrag }: {
  mapRef: React.RefObject<MapView | null>;
  trip: Trip;
  lot: ParkingLot;
  destination: LatLng;
  onPanDrag: () => void;
}) {
  const t = useTheme();
  // Sin Google Maps (Android sin clave) la ruta se sigue igual con el panel
  // inferior y las indicaciones; sólo falta el dibujo.
  if (!mapsAvailable) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.noMap, { backgroundColor: t.colors.surfaceSunken }]}>
        <Ionicons name="navigate-circle-outline" size={64} color={t.colors.textMuted} />
      </View>
    );
  }
  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
      initialRegion={regionForPoints(trip.location ? [trip.location, destination] : [destination], 0.6)}
      customMapStyle={t.scheme === 'dark' ? darkMapStyle : lightMapStyle}
      showsUserLocation={trip.permission === 'granted'}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      onPanDrag={onPanDrag}
    >
      {trip.route ? (
        <>
          {/* Trazo doble: un borde ancho y oscuro debajo mantiene la ruta
              legible sobre calles claras y sobre parques. */}
          <Polyline
            coordinates={trip.route.polyline}
            strokeColor={t.alpha(t.palette.brand[900], 0.35)}
            strokeWidth={11}
            lineCap="round"
            lineJoin="round"
          />
          <Polyline
            coordinates={trip.route.polyline}
            strokeColor={t.colors.brand}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
            // La ruta estimada se dibuja punteada: deja claro que es
            // aproximada y no un trazado real por calles.
            lineDashPattern={trip.route.source === 'estimated' ? [12, 10] : undefined}
          />
        </>
      ) : null}

      <Circle
        center={destination}
        radius={80}
        strokeColor={t.alpha(t.colors.success, 0.7)}
        fillColor={t.alpha(t.colors.success, 0.14)}
        strokeWidth={2}
      />

      <Marker coordinate={destination} title={lot.name} description={lot.address} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={[styles.destPin, { backgroundColor: t.colors.brand, borderColor: t.palette.white }, t.elevation('md')]}>
          <Ionicons name="business" size={16} color={t.palette.white} />
        </View>
      </Marker>
    </MapView>
  );
}

function RoundButton({ icon, label, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.roundBtn,
        { backgroundColor: t.colors.surface, borderColor: t.colors.border, opacity: pressed ? 0.75 : 1 },
        t.elevation('md'),
      ]}
    >
      <Ionicons name={icon} size={20} color={t.colors.textPrimary} />
    </Pressable>
  );
}

/** Indicación inmediata y la siguiente, arriba de la pantalla. */
function StepBanner({ trip }: { trip: Trip }) {
  const t = useTheme();
  if (!trip.currentStep) return null;
  return (
    <Card elevation="lg" style={[styles.stepCard, { gap: t.spacing.md }]}>
      <View style={[styles.maneuver, { backgroundColor: t.colors.brandSoft, borderRadius: t.radius.md }]}>
        <Ionicons name={trip.currentStep.maneuver} size={22} color={t.colors.brand} />
      </View>
      <View style={styles.cardText}>
        <Text variant="caption" tone="secondary" numberOfLines={2}>{trip.currentStep.instruction}</Text>
        {trip.nextStep ? (
          <Text variant="micro" tone="muted" numberOfLines={1}>Luego: {trip.nextStep.instruction}</Text>
        ) : null}
      </View>
    </Card>
  );
}

function RouteStatusBadge({ trip, top }: { trip: Trip; top: number }) {
  if (trip.recalculating) {
    return <Badge label="Recalculando ruta…" tone="warning" icon="sync" style={[styles.floatingBadge, { top }]} />;
  }
  if (trip.offRoute) {
    return <Badge label="Te saliste de la ruta" tone="warning" dot style={[styles.floatingBadge, { top }]} />;
  }
  return null;
}

function RecenterButton({ active, bottom, onPress }: { active: boolean; bottom: number; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Volver a seguir mi posición"
      style={({ pressed }) => [
        styles.recenterBtn,
        {
          bottom,
          backgroundColor: active ? t.colors.brand : t.colors.surface,
          borderColor: active ? t.colors.brand : t.colors.border,
          opacity: pressed ? 0.75 : 1,
        },
        t.elevation('md'),
      ]}
    >
      <Ionicons name="navigate" size={20} color={active ? t.colors.textOnBrand : t.colors.textSecondary} />
    </Pressable>
  );
}

function TripSheetBody({ trip, lot, destination, reservation, arrived, showSteps, onToggleSteps, onArrived }: {
  trip: Trip;
  lot: ParkingLot;
  destination: LatLng;
  reservation: Reservation | null;
  arrived: boolean;
  showSteps: boolean;
  onToggleSteps: () => void;
  onArrived: () => void;
}) {
  if (trip.loading) return <LoadingState label="Calculando la mejor ruta…" />;
  if (trip.error && !trip.route) return <ErrorState message={trip.error} onRetry={trip.recalculate} />;
  if (arrived) return <ArrivedPanel lotName={lot.name} hasReservation={Boolean(reservation)} onArrived={onArrived} />;

  const slack = arrivalSlack(reservation, trip.remainingSeconds);
  return (
    <>
      <TripProgress trip={trip} />
      <TripChips trip={trip} lotName={lot.name} slack={slack} />
      {slack != null && slack < 0 ? <LateWarning /> : null}
      <TripActions
        showSteps={showSteps}
        onOpenExternal={() => openExternalNavigation(destination, lot.name)}
        onToggleSteps={onToggleSteps}
      />
      {showSteps && trip.route ? <StepList trip={trip} /> : null}
    </>
  );
}

function ArrivedPanel({ lotName, hasReservation, onArrived }: {
  lotName: string; hasReservation: boolean; onArrived: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.md }}>
      <View style={[styles.row, { gap: t.spacing.md }]}>
        <View style={[styles.bigIcon, { backgroundColor: t.colors.successSoft, borderRadius: t.radius.lg }]}>
          <Ionicons name="checkmark-circle" size={26} color={t.colors.success} />
        </View>
        <View style={styles.cardText}>
          <Text variant="heading">Llegaste</Text>
          <Text variant="caption" tone="secondary">
            Estás en {lotName}. Ten listo tu código QR de entrada.
          </Text>
        </View>
      </View>
      <Button
        label={hasReservation ? 'Ver mi código QR' : 'Ver parqueadero'}
        icon="qr-code-outline"
        onPress={onArrived}
        size="lg"
      />
    </View>
  );
}

function TripProgress({ trip }: { trip: Trip }) {
  return (
    <>
      <View style={[styles.between, styles.alignStart]}>
        <View style={styles.gap2}>
          <Text variant="micro" tone="muted">Llegas a las</Text>
          <Text variant="numeric">{formatEta(trip.remainingSeconds)}</Text>
        </View>
        <View style={[styles.alignEnd, styles.gap2]}>
          <Text variant="heading" tone="brand">{formatDuration(trip.remainingSeconds)}</Text>
          <Text variant="caption" tone="secondary">{formatDistance(trip.remainingMeters)}</Text>
        </View>
      </View>
      <ProgressBar value={trip.progress} height={6} />
    </>
  );
}

function TripChips({ trip, lotName, slack }: { trip: Trip; lotName: string; slack: number | null }) {
  const t = useTheme();
  return (
    <View style={[styles.chips, { gap: t.spacing.xs }]}>
      <Badge label={lotName} icon="business-outline" />
      {trip.route?.source === 'estimated' ? (
        <Badge label="Ruta aproximada" tone="warning" icon="information-circle-outline" />
      ) : trip.route?.summary ? (
        <Badge label={`Vía ${trip.route.summary}`} tone="accent" icon="git-branch-outline" />
      ) : null}
      {slack != null ? (
        <Badge
          label={slack < 0 ? `Llegas ${Math.abs(slack)} min tarde` : `${slack} min de margen`}
          tone={slackTone(slack)}
          icon="time-outline"
        />
      ) : null}
    </View>
  );
}

function LateWarning() {
  const t = useTheme();
  return (
    <View style={[styles.warning, { backgroundColor: t.colors.dangerSoft, borderRadius: t.radius.sm, gap: t.spacing.sm }]}>
      <Ionicons name="alert-circle" size={17} color={t.colors.danger} />
      <Text variant="micro" tone="danger" style={styles.flex}>
        Tu reserva vence antes de que llegues. Si expira, el espacio se
        libera y tendrás que reservar de nuevo.
      </Text>
    </View>
  );
}

function TripActions({ showSteps, onOpenExternal, onToggleSteps }: {
  showSteps: boolean; onOpenExternal: () => void; onToggleSteps: () => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.actions, { gap: t.spacing.sm }]}>
      <Button label="Abrir en mapas" variant="secondary" icon="open-outline" size="sm" onPress={onOpenExternal} style={styles.flex} />
      <Button
        label={showSteps ? 'Ocultar pasos' : 'Ver pasos'}
        variant="secondary"
        icon={showSteps ? 'chevron-down' : 'list-outline'}
        size="sm"
        onPress={onToggleSteps}
        style={styles.flex}
      />
    </View>
  );
}

function StepList({ trip }: { trip: Trip }) {
  const t = useTheme();
  if (!trip.route) return null;
  return (
    <ScrollView style={styles.stepList} showsVerticalScrollIndicator={false}>
      <View style={{ gap: t.spacing.sm }}>
        {trip.route.steps.map((step) => {
          const active = step === trip.currentStep;
          return (
            <View key={`${step.end.latitude},${step.end.longitude}`} style={[styles.row, { gap: t.spacing.md, opacity: active ? 1 : 0.6 }]}>
              <Ionicons name={step.maneuver} size={17} color={active ? t.colors.brand : t.colors.textMuted} />
              <Text variant="micro" tone={active ? 'primary' : 'secondary'} style={styles.flex}>
                {step.instruction}
              </Text>
              <Text variant="micro" tone="muted">{formatDistance(step.distanceMeters)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex:          { flex: 1 },
  noMap:         { alignItems: 'center', justifyContent: 'center' },
  cardText:      { flex: 1, gap: 2 },
  gap2:          { gap: 2 },
  alignStart:    { alignItems: 'flex-start' },
  alignEnd:      { alignItems: 'flex-end' },
  stepList:      { maxHeight: 150 },
  root:          { flex: 1 },
  header:        { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'flex-start' },
  roundBtn:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stepCard:      { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  maneuver:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  floatingBadge: { position: 'absolute', alignSelf: 'center' },
  recenterBtn:   { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sheet:         { position: 'absolute', bottom: 0, left: 0, right: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grabber:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  destPin:       { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  between:       { flexDirection: 'row', justifyContent: 'space-between' },
  row:           { flexDirection: 'row', alignItems: 'center' },
  chips:         { flexDirection: 'row', flexWrap: 'wrap' },
  warning:       { flexDirection: 'row', alignItems: 'center', padding: 10 },
  actions:       { flexDirection: 'row' },
  bigIcon:       { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
