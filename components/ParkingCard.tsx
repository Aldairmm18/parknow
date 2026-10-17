import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, ProgressBar, Text, useOccupancyTone } from '@/components/ui';
import { ParkingLotWithAvailability } from '@/domain/models';
import { formatDistance } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  parking: ParkingLotWithAvailability;
  onPress: (parking: ParkingLotWithAvailability) => void;
  /** Acción secundaria: trazar la ruta sin entrar al detalle. */
  onNavigate?: (parking: ParkingLotWithAvailability) => void;
}

/**
 * Tarjeta de parqueadero.
 *
 * La jerarquía es deliberada: lo primero que se lee es si hay sitio y a qué
 * distancia está; el precio y la capacidad quedan en segundo plano. Antes todo
 * competía por la atención con el mismo peso visual.
 */
export const ParkingCard = React.memo(function ParkingCard({ parking, onPress, onNavigate }: Props) {
  const t = useTheme();
  // Los manejadores reciben el parqueadero: así la lista pasa la misma función
  // a todas las filas y React.memo puede saltarse las que no cambiaron.
  const press = useCallback(() => onPress(parking), [onPress, parking]);
  const navigate = useCallback(() => onNavigate?.(parking), [onNavigate, parking]);
  const occupancy = useOccupancyTone(parking.occupancyPercent);
  const hasSlots = parking.availableSlots > 0;

  return (
    <Card onPress={press} elevation="sm" style={{ gap: t.spacing.md }}>
      <View style={[styles.header, { gap: t.spacing.md }]}>
        <View
          style={[
            styles.icon,
            { backgroundColor: hasSlots ? t.colors.successSoft : t.colors.surfaceSunken, borderRadius: t.radius.md },
          ]}
        >
          <Ionicons
            name="business"
            size={20}
            color={hasSlots ? t.colors.success : t.colors.textMuted}
          />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={1}>{parking.name}</Text>
          <View style={[styles.metaRow, { gap: 4 }]}>
            {parking.distanceMeters != null ? (
              <>
                <Ionicons name="navigate" size={11} color={t.colors.accentText} />
                <Text variant="micro" tone="accent">{formatDistance(parking.distanceMeters)}</Text>
                <Text variant="micro" tone="muted">·</Text>
              </>
            ) : null}
            <Text variant="micro" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
              {parking.address || 'Sin dirección registrada'}
            </Text>
          </View>
        </View>

        <Badge
          label={hasSlots ? `${parking.availableSlots} libres` : 'Lleno'}
          tone={hasSlots ? 'success' : 'danger'}
          dot
        />
      </View>

      <View style={{ gap: 5 }}>
        <ProgressBar value={parking.occupancyPercent / 100} color={occupancy.color} height={5} />
        <View style={styles.between}>
          <Text variant="micro" tone="muted">{parking.occupancyPercent}% ocupado</Text>
          <Text variant="micro" color={occupancy.color}>{occupancy.label}</Text>
        </View>
      </View>

      <View style={[styles.footer, { gap: t.spacing.sm, borderTopColor: t.colors.border, paddingTop: t.spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text variant="micro" tone="muted">Desde</Text>
          <Text variant="bodyStrong" tone="brand">
            ${parking.pricePerBlock.toLocaleString('es-CO')}
            <Text variant="micro" tone="muted"> / 30 min</Text>
          </Text>
        </View>

        <Facility icon="car-outline" value={parking.carCapacity} label="carros" />
        <Facility icon="bicycle-outline" value={parking.motoCapacity} label="motos" />

        {onNavigate ? (
          <Ionicons
            name="navigate-circle"
            size={30}
            color={t.colors.accent}
            onPress={navigate}
            suppressHighlighting
          />
        ) : null}
      </View>
    </Card>
  );
});

function Facility({ icon, value, label }: { icon: any; value: number; label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.facility, { gap: 3 }]}>
      <Ionicons name={icon} size={14} color={t.colors.textMuted} />
      <Text variant="micro" tone="secondary">{value}</Text>
      <Text variant="micro" tone="muted">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'center' },
  icon:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  metaRow:  { flexDirection: 'row', alignItems: 'center' },
  between:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footer:   { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1 },
  facility: { flexDirection: 'row', alignItems: 'center' },
});
