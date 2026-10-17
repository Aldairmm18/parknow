import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge, Button, Card, EmptyState, ErrorState, Header, Screen, Skeleton, Text, BottomSpacer,
} from '@/components/ui';
import { ReservationStatusBadge } from '@/components/ReservationStatusBadge';
import { reservationService, CANCELLATION_CUTOFF_MINUTES } from '@/services/reservationService';
import { authService } from '@/services/authService';
import { Reservation } from '@/domain/models';
import { ReservationStatus, VehicleType } from '@/domain/enums';
import { floorLabelFor, spotLabelFor } from '@/domain/floorPlan';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

const ACTIVE_STATUSES = [ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN];

const canCancel = (r: Reservation) =>
  r.status === ReservationStatus.RESERVED &&
  parseISO(r.startsAt).getTime() - Date.now() > CANCELLATION_CUTOFF_MINUTES * 60 * 1000;

export default function ReservasScreen() {
  const t = useTheme();
  const router = useRouter();

  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const user = await authService.currentUser();
      if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
      setReservations(await reservationService.getMine());
    } catch (e: any) {
      setError(e?.message ?? 'No pudimos cargar tus reservas.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sections = useMemo(() => {
    if (!reservations) return [];
    const active = reservations.filter((r) => ACTIVE_STATUSES.includes(r.status));
    const past = reservations.filter((r) => !ACTIVE_STATUSES.includes(r.status));
    return [
      ...(active.length ? [{ title: 'Activas', data: active }] : []),
      ...(past.length ? [{ title: 'Historial', data: past }] : []),
    ];
  }, [reservations]);

  const handleCancel = useCallback((reservation: Reservation) => {
    Alert.alert(
      'Cancelar reserva',
      `Se cancelará tu reserva del ${format(parseISO(reservation.startsAt), "d 'de' MMMM 'a las' HH:mm", { locale: es })} y te devolveremos el importe completo.`,
      [
        { text: 'Conservarla', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(reservation.id);
            try {
              await reservationService.cancelReservation(reservation.id);
              await load();
            } catch (e: any) {
              Alert.alert('No se pudo cancelar', e?.message ?? 'Inténtalo de nuevo.');
            } finally {
              setCancelling(null);
            }
          },
        },
      ],
    );
  }, [load]);

  const openReservation = useCallback(
    (r: Reservation) => router.push(`/parking/confirmation?reservationId=${r.id}`),
    [router],
  );
  const navigateTo = useCallback(
    (r: Reservation) => router.push(`/parking/navigate?reservationId=${r.id}`),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: Reservation }) => (
      <ReservationCard
        reservation={item}
        cancelling={cancelling === item.id}
        canCancel={canCancel(item)}
        onPress={openReservation}
        onNavigate={navigateTo}
        onCancel={handleCancel}
      />
    ),
    [cancelling, openReservation, navigateTo, handleCancel],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <Text variant="overline" tone="muted" style={styles.sectionTitle}>{section.title}</Text>
    ),
    [],
  );

  const activeCount = reservations?.filter((r) => ACTIVE_STATUSES.includes(r.status)).length ?? 0;

  return (
    <Screen>
      <Header
        overline="Mis reservas"
        title="Tus estacionamientos"
        subtitle={
          activeCount > 0
            ? `${activeCount} reserva${activeCount > 1 ? 's' : ''} activa${activeCount > 1 ? 's' : ''}`
            : 'Aquí aparece todo tu historial'
        }
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListFooterComponent={<BottomSpacer extra={t.spacing['4xl'] - t.spacing.sm} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.colors.brand}
            colors={[t.colors.brand]}
          />
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        ListEmptyComponent={
          error ? (
            <ErrorState message={error} onRetry={load} />
          ) : !reservations ? (
            <View style={{ gap: t.spacing.md, paddingTop: t.spacing.md }}>
              <Skeleton height={112} radius={18} />
              <Skeleton height={112} radius={18} />
            </View>
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Todavía no has reservado"
              message="Busca un parqueadero, elige tu espacio en 3D y listo."
              actionLabel="Buscar parqueadero"
              onAction={() => router.push('/(tabs)')}
            />
          )
        }
      />
    </Screen>
  );
}

const ReservationCard = React.memo(function ReservationCard({
  reservation, canCancel: cancellable, cancelling, onPress, onNavigate, onCancel,
}: {
  reservation: Reservation;
  canCancel: boolean;
  cancelling: boolean;
  onPress: (r: Reservation) => void;
  onNavigate: (r: Reservation) => void;
  onCancel: (r: Reservation) => void;
}) {
  const t = useTheme();
  const press = useCallback(() => onPress(reservation), [onPress, reservation]);
  const navigate = useCallback(() => onNavigate(reservation), [onNavigate, reservation]);
  const cancel = useCallback(() => onCancel(reservation), [onCancel, reservation]);
  const isMoto = reservation.vehicleType === VehicleType.MOTORCYCLE;
  const isActive = ACTIVE_STATUSES.includes(reservation.status);
  // La ruta sirve mientras no haya entrado: también durante los minutos de
  // cortesía después del inicio, que es justo cuando más se necesita.
  const canNavigate = reservation.status === ReservationStatus.RESERVED;

  return (
    <Card onPress={press} elevation={isActive ? 'md' : 'sm'} style={{ gap: t.spacing.md }}>
      <View style={[styles.row, { gap: t.spacing.md }]}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: isActive ? t.colors.brandSoft : t.colors.surfaceSunken,
              borderRadius: t.radius.md,
            },
          ]}
        >
          <Ionicons
            name={isMoto ? 'bicycle' : 'car'}
            size={19}
            color={isActive ? t.colors.brand : t.colors.textMuted}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="micro" tone="muted" style={{ textTransform: 'capitalize' }}>
            {format(parseISO(reservation.startsAt), "EEEE d 'de' MMM", { locale: es })}
          </Text>
          <Text variant="bodyStrong">
            {format(parseISO(reservation.startsAt), 'HH:mm')} — {format(parseISO(reservation.endsAt), 'HH:mm')}
          </Text>
        </View>

        <ReservationStatusBadge status={reservation.status} />
      </View>

      <View style={[styles.chips, { gap: t.spacing.xs }]}>
        {reservation.assignedFloor != null ? (
          <Badge
            label={`${floorLabelFor(reservation.assignedFloor)} · ${spotLabelFor(reservation.assignedSpot ?? 0)}`}
            tone="brand"
            icon="location-outline"
          />
        ) : null}
        {reservation.vehiclePlate ? (
          <Badge label={reservation.vehiclePlate} icon="pricetag-outline" />
        ) : null}
      </View>

      {canNavigate || cancellable ? (
        <View style={[styles.actions, { gap: t.spacing.sm, borderTopColor: t.colors.border, paddingTop: t.spacing.md }]}>
          {canNavigate ? (
            <Button
              label="Cómo llegar"
              icon="navigate"
              variant="secondary"
              size="sm"
              onPress={navigate}
              style={{ flex: 1 }}
            />
          ) : null}
          {cancellable ? (
            <Button
              label="Cancelar"
              icon="close-circle-outline"
              variant="danger"
              size="sm"
              loading={cancelling}
              onPress={cancel}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
});

const styles = StyleSheet.create({
  sectionTitle: { marginTop: spacing.md, marginBottom: 2 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  row:     { flexDirection: 'row', alignItems: 'center' },
  icon:    { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  chips:   { flexDirection: 'row', flexWrap: 'wrap' },
  actions: { flexDirection: 'row', borderTopWidth: 1 },
});
