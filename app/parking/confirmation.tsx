import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { differenceInSeconds, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge, Button, Card, ErrorState, Header, LoadingState, Screen, Text, BottomSpacer,
} from '@/components/ui';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { floorLabelFor, spotLabelFor } from '@/domain/floorPlan';
import { ReservationStatusBadge } from '@/components/ReservationStatusBadge';
import { reservationRepository } from '@/repositories/reservationRepository';
import { parkingService } from '@/services/parkingService';
import { ParkingLot, Reservation } from '@/domain/models';
import { ReservationStatus, VehicleType } from '@/domain/enums';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Carga la reserva, su parqueadero y, si sigue activa, el QR de entrada. */
function useReservationDetail(reservationId: string | undefined) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [lot, setLot] = useState<ParkingLot | null>(null);
  const [qrValue, setQrValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const found = await reservationRepository.getById(reservationId!);
      if (!found) throw new Error('No encontramos esta reserva.');
      setReservation(found);
      setLot(await parkingService.getById(found.parkingLotId));

      if (found.status === ReservationStatus.RESERVED) {
        const qr = await reservationRepository.getEntryQRForReservation(found.id);
        setQrValue(qr?.tokenHash ?? '');
      }
    } catch (e: any) {
      setError(e?.message ?? 'No pudimos cargar la reserva.');
    }
  }, [reservationId]);

  useEffect(() => { load(); }, [load]);

  return { reservation, lot, qrValue, error, load };
}

export default function ConfirmationScreen() {
  const t = useTheme();
  const router = useRouter();
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
  const { reservation, lot, qrValue, error, load } = useReservationDetail(reservationId);

  if (error) {
    return (
      <Screen>
        <Header title="Reserva" back onBack={() => router.replace('/(tabs)/reservas')} />
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  if (!reservation) {
    return (
      <Screen>
        <Header title="Reserva" back onBack={() => router.replace('/(tabs)/reservas')} />
        <LoadingState />
      </Screen>
    );
  }

  const isActive = reservation.status === ReservationStatus.RESERVED;
  const isInside = reservation.status === ReservationStatus.CHECKED_IN;

  return (
    <Screen>
      <Header
        overline={lot?.name ?? 'Reserva'}
        title={isInside ? 'Estás dentro' : isActive ? 'Reserva confirmada' : 'Detalle de reserva'}
        back
        onBack={() => router.replace('/(tabs)/reservas')}
        right={<ReservationStatusBadge status={reservation.status} />}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* Código QR: lo primero, porque es para lo que se abre esta pantalla. */}
        {isActive && qrValue ? (
          <EntryQrCard qrValue={qrValue} deadline={reservation.arrivalDeadlineAt} />
        ) : isInside ? (
          <InsideCard checkedInAt={reservation.checkedInAt} />
        ) : null}

        {reservation.assignedFloor != null ? <AssignedSpotCard reservation={reservation} /> : null}

        <ReservationInfoCard reservation={reservation} address={lot?.address} />

        <View style={{ gap: t.spacing.sm }}>
          {isActive && lot?.latitude != null ? (
            <Button
              label="Cómo llegar"
              icon="navigate"
              onPress={() => router.push(`/parking/navigate?reservationId=${reservation.id}`)}
              size="lg"
            />
          ) : null}
          <Button
            label="Ir al inicio"
            variant="secondary"
            icon="home-outline"
            onPress={() => router.replace('/(tabs)')}
          />
        </View>
        <BottomSpacer extra={t.spacing['3xl'] - t.spacing.md} />
      </ScrollView>
    </Screen>
  );
}

function EntryQrCard({ qrValue, deadline }: { qrValue: string; deadline?: string }) {
  const t = useTheme();
  return (
    <Card elevation="md" style={[styles.centered, { gap: t.spacing.lg }]}>
      <View style={[styles.centered, { gap: 4 }]}>
        <Text variant="heading">Tu código de entrada</Text>
        <Text variant="caption" tone="secondary" center>
          Muéstralo en la barrera. Sirve una sola vez.
        </Text>
      </View>
      <QRCodeDisplay value={qrValue} size={210} />
      {deadline ? <ArrivalCountdown deadline={deadline} /> : null}
    </Card>
  );
}

function InsideCard({ checkedInAt }: { checkedInAt?: string }) {
  const t = useTheme();
  return (
    <Card tone="brand" elevation="md" style={[styles.row, { gap: t.spacing.md }]}>
      <View style={[styles.bigIcon, { backgroundColor: t.colors.successSoft, borderRadius: t.radius.lg }]}>
        <Ionicons name="checkmark-circle" size={26} color={t.colors.success} />
      </View>
      <View style={styles.cardText}>
        <Text variant="bodyStrong">Entrada registrada</Text>
        <Text variant="micro" tone="secondary">
          {checkedInAt
            ? `Ingresaste a las ${format(parseISO(checkedInAt), 'HH:mm')}.`
            : 'Tu vehículo está dentro.'}
          {' '}Al salir usa tu código de salida en la barrera.
        </Text>
      </View>
    </Card>
  );
}

function AssignedSpotCard({ reservation }: { reservation: Reservation }) {
  const t = useTheme();
  return (
    <Card tone="brand" style={[styles.row, { gap: t.spacing.md }]}>
      <View style={[styles.bigIcon, { backgroundColor: t.colors.brand, borderRadius: t.radius.lg }]}>
        <Ionicons name="location" size={24} color={t.colors.textOnBrand} />
      </View>
      <View style={styles.cardText}>
        <Text variant="micro" tone="muted">Tu espacio</Text>
        <Text variant="heading" tone="brand">
          {floorLabelFor(reservation.assignedFloor!)} · {reservation.assignedSpot != null ? spotLabelFor(reservation.assignedSpot) : '—'}
        </Text>
      </View>
    </Card>
  );
}

function ReservationInfoCard({ reservation, address }: { reservation: Reservation; address?: string }) {
  const t = useTheme();
  const isMoto = reservation.vehicleType === VehicleType.MOTORCYCLE;
  const start = parseISO(reservation.startsAt);
  return (
    <Card style={{ gap: t.spacing.md }}>
      <Text variant="overline" tone="muted">Información</Text>
      <Row icon="calendar-outline" label="Día" value={format(start, "EEEE d 'de' MMMM", { locale: es })} />
      <Row icon="time-outline" label="Horario"
        value={`${format(start, 'HH:mm')} — ${format(parseISO(reservation.endsAt), 'HH:mm')}`} />
      <Row icon={isMoto ? 'bicycle-outline' : 'car-outline'} label="Vehículo"
        value={`${isMoto ? 'Moto' : 'Carro'} · ${reservation.vehiclePlate}`} />
      {address ? <Row icon="business-outline" label="Dirección" value={address} /> : null}
    </Card>
  );
}

/**
 * Cuenta atrás hasta el límite de llegada.
 *
 * Cambia de color al acercarse: es la diferencia entre llegar a tiempo y
 * encontrarse la reserva expirada.
 */
/**
 * Cuenta atrás legible a cualquier distancia: `2 d 3 h` para reservas de
 * otro día, `17 h 50 min` para más tarde hoy y `mm:ss` en la última hora.
 */
function formatCountdown(totalSeconds: number, minutes: number, seconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes % 60} min`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function ArrivalCountdown({ deadline }: { deadline: string }) {
  const t = useTheme();
  const [secondsLeft, setSecondsLeft] = useState(() =>
    differenceInSeconds(parseISO(deadline), new Date()));

  useEffect(() => {
    const id = setInterval(
      () => setSecondsLeft(differenceInSeconds(parseISO(deadline), new Date())),
      1000,
    );
    return () => clearInterval(id);
  }, [deadline]);

  if (secondsLeft <= 0) {
    return <Badge label="El plazo de llegada venció" tone="danger" icon="alert-circle" />;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const tone = minutes < 5 ? 'danger' : minutes < 12 ? 'warning' : 'success';

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text variant="micro" tone="muted" center style={styles.fullWidth}>Tiempo para llegar</Text>
      <Text
        variant="numeric"
        color={tone === 'danger' ? t.colors.danger : tone === 'warning' ? t.colors.warning : t.colors.success}
      >
        {formatCountdown(secondsLeft, minutes, seconds)}
      </Text>
      <Text variant="micro" tone="muted" center style={styles.fullWidth}>
        (hasta las {format(parseISO(deadline), 'HH:mm')})
      </Text>
    </View>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, { gap: t.spacing.md }]}>
      <Ionicons name={icon} size={17} color={t.colors.textMuted} />
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>{label}</Text>
      <Text
        variant="caption"
        style={{ flexShrink: 1, textAlign: 'right', textTransform: 'capitalize' }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // En Android, un texto centrado y medido a su ancho justo puede perder la
  // última palabra; ocupar toda la fila lo evita.
  fullWidth: { alignSelf: 'stretch' },
  centered: { alignItems: 'center' },
  cardText: { flex: 1, gap: 2 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  row:     { flexDirection: 'row', alignItems: 'center' },
  bigIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
});
