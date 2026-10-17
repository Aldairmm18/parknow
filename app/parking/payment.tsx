import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Field, Header, Screen, Text, BottomSpacer } from '@/components/ui';
import { authService } from '@/services/authService';
import { reservationService, ARRIVAL_GRACE_MINUTES } from '@/services/reservationService';
import { VehicleType } from '@/domain/enums';
import { floorLabelFor } from '@/domain/floorPlan';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/** Placas colombianas: carro `ABC123`, moto `ABC12` o `ABC12A`. */
const PLATE_CAR = /^[A-Z]{3}\d{3}$/;
const PLATE_MOTO = /^[A-Z]{3}\d{2}[A-Z]?$/;

export default function PaymentScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    parkingId: string; slotIds: string; startsAt: string; endsAt: string;
    totalPrice: string; vehicleType?: string; spotFloor?: string;
    spotNumber?: string; spotLabel?: string;
  }>();

  const [vehicleType, setVehicleType] = useState<VehicleType>(
    (params.vehicleType as VehicleType) ?? VehicleType.CAR,
  );
  const [plate, setPlate] = useState('');
  const [plateError, setPlateError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isCar = vehicleType === VehicleType.CAR;
  const price = Number(params.totalPrice ?? 0);
  const slotIds = (params.slotIds ?? '').split(',').filter(Boolean);
  const start = params.startsAt ? parseISO(params.startsAt) : new Date();
  const end = params.endsAt ? parseISO(params.endsAt) : new Date();

  const validatePlate = (value: string) => {
    const normalized = value.toUpperCase().replace(/[\s-]/g, '');
    if (!normalized) return 'Escribe la placa de tu vehículo.';
    const pattern = isCar ? PLATE_CAR : PLATE_MOTO;
    if (!pattern.test(normalized)) {
      return isCar
        ? 'Una placa de carro son 3 letras y 3 números: ABC123.'
        : 'Una placa de moto son 3 letras y 2 números: ABC12.';
    }
    return undefined;
  };

  const handleConfirm = async () => {
    const error = validatePlate(plate);
    if (error) { setPlateError(error); return; }

    setLoading(true);
    setFormError(null);
    try {
      const user = await authService.currentUser();
      if (!user) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

      const { reservation } = await reservationService.createReservation({
        parkingLotId: params.parkingId!,
        vehicleType,
        vehiclePlate: plate,
        selectedSlots: slotIds.map((id) => ({
          id, startsAt: params.startsAt!, endsAt: params.endsAt!,
        })),
        preferredSpot: params.spotNumber
          ? { floor: Number(params.spotFloor), number: Number(params.spotNumber) }
          : null,
      });

      router.replace(`/parking/confirmation?reservationId=${reservation.id}`);
    } catch (e: any) {
      setFormError(e?.message ?? 'No pudimos confirmar tu reserva.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Header overline="Paso 3 de 3" title="Confirma y paga" back />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Resumen */}
          <Card style={{ gap: t.spacing.md }}>
            <Text variant="overline" tone="muted">Tu reserva</Text>

            <SummaryRow
              icon="calendar-outline"
              label="Fecha"
              value={format(start, "EEEE d 'de' MMMM", { locale: es })}
            />
            <SummaryRow
              icon="time-outline"
              label="Horario"
              value={`${format(start, 'HH:mm')} — ${format(end, 'HH:mm')} · ${slotIds.length * 30} min`}
            />
            {params.spotLabel ? (
              <SummaryRow
                icon="location-outline"
                label="Espacio elegido"
                value={`${floorLabelFor(Number(params.spotFloor))} · ${params.spotLabel}`}
                highlight
              />
            ) : (
              <SummaryRow
                icon="shuffle-outline"
                label="Espacio"
                value="Se asigna automáticamente"
              />
            )}
          </Card>

          {/* Vehículo */}
          <Card style={{ gap: t.spacing.md }}>
            <Text variant="overline" tone="muted">Tu vehículo</Text>

            <View style={[styles.row, { gap: t.spacing.sm }]}>
              <VehicleOption
                label="Carro"
                icon="car"
                active={isCar}
                onPress={() => { setVehicleType(VehicleType.CAR); setPlate(''); setPlateError(undefined); }}
              />
              <VehicleOption
                label="Moto"
                icon="bicycle"
                active={!isCar}
                onPress={() => { setVehicleType(VehicleType.MOTORCYCLE); setPlate(''); setPlateError(undefined); }}
              />
            </View>

            <Field
              label="Placa"
              icon="pricetag-outline"
              value={plate}
              onChangeText={(v) => {
                setPlate(v.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                setPlateError(undefined);
              }}
              onBlur={() => setPlateError(validatePlate(plate))}
              error={plateError}
              hint={isCar ? 'Ejemplo: ABC123' : 'Ejemplo: ABC12'}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={isCar ? 6 : 6}
              placeholder={isCar ? 'ABC123' : 'ABC12'}
            />
          </Card>

          {/* Aviso de llegada */}
          <Card tone="sunken" elevation="none" style={[styles.row, { gap: t.spacing.md }]}>
            <Ionicons name="alarm-outline" size={19} color={t.colors.warning} />
            <Text variant="micro" tone="secondary" style={{ flex: 1 }}>
              Tienes {ARRIVAL_GRACE_MINUTES} minutos desde el inicio para llegar. Pasado
              ese plazo la reserva expira y el espacio se libera.
            </Text>
          </Card>

          {/* Desglose */}
          <Card style={{ gap: t.spacing.sm }}>
            <Text variant="overline" tone="muted">Detalle del cobro</Text>
            <View style={styles.between}>
              <Text variant="caption" tone="secondary">
                {slotIds.length} bloque{slotIds.length > 1 ? 's' : ''} de 30 min
              </Text>
              <Text variant="caption">${price.toLocaleString('es-CO')}</Text>
            </View>
            <View style={[styles.between, { borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.spacing.sm }]}>
              <Text variant="bodyStrong">Total</Text>
              <Text variant="heading" tone="brand">${price.toLocaleString('es-CO')} COP</Text>
            </View>
            <Text variant="micro" tone="muted">
              Cancelación gratuita hasta 30 minutos antes del inicio.
            </Text>
          </Card>

          {formError ? (
            <View style={[styles.alert, { backgroundColor: t.colors.dangerSoft, borderRadius: t.radius.sm, gap: t.spacing.sm }]}>
              <Ionicons name="alert-circle" size={17} color={t.colors.danger} />
              <Text variant="caption" tone="danger" style={{ flex: 1 }}>{formError}</Text>
            </View>
          ) : null}
          <BottomSpacer extra={140 - t.spacing.md} />
        </ScrollView>
      </KeyboardAvoidingView>

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
          <Badge
            label={params.spotLabel ? `Espacio ${params.spotLabel}` : 'Espacio automático'}
            tone="brand"
            icon="location-outline"
          />
          <Text variant="heading">${price.toLocaleString('es-CO')}</Text>
        </View>
        <Button
          label="Confirmar y pagar"
          icon="lock-closed"
          loading={loading}
          onPress={handleConfirm}
          size="lg"
        />
      </View>
    </Screen>
  );
}

function SummaryRow({ icon, label, value, highlight }: {
  icon: any; label: string; value: string; highlight?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, { gap: t.spacing.md }]}>
      <Ionicons name={icon} size={17} color={highlight ? t.colors.brand : t.colors.textMuted} />
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>{label}</Text>
      <Text
        variant="caption"
        tone={highlight ? 'brand' : 'primary'}
        style={{ flexShrink: 1, textAlign: 'right', textTransform: 'capitalize' }}
      >
        {value}
      </Text>
    </View>
  );
}

function VehicleOption({ label, icon, active, onPress }: {
  label: string; icon: any; active: boolean; onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.vehicle,
        {
          borderRadius: t.radius.md,
          backgroundColor: active ? t.colors.brandSoft : t.colors.surface,
          borderColor: active ? t.colors.brand : t.colors.border,
          borderWidth: active ? 1.5 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={active ? t.colors.brand : t.colors.textMuted} />
      <Text variant="caption" tone={active ? 'brand' : 'secondary'}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  flex:    { flex: 1 },
  row:     { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  alert:   { flexDirection: 'row', alignItems: 'center', padding: 12 },
  footer:  { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
});
