import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Badge, BottomSpacer, Card, Text } from '@/components/ui';
import { ParkingLotWithAvailability } from '@/domain/models';
import { formatDistance } from '@/lib/geo';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

/**
 * Lo que se ve en la pestaña Mapa cuando no se puede montar Google Maps
 * (build de Android sin `GOOGLE_MAPS_API_KEY`). En vez de cerrar la app, se
 * explica y se ofrece la lista de parqueaderos, que lleva al mismo detalle.
 */
export function MapUnavailable({ lots }: { lots: ParkingLotWithAvailability[] }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const openLot = useCallback(
    (lot: ParkingLotWithAvailability) => router.push(`/parking/${lot.id}`),
    [router],
  );
  const renderLot = useCallback(
    ({ item }: { item: ParkingLotWithAvailability }) => <LotRow lot={item} onPress={openLot} />,
    [openLot],
  );

  return (
    <FlatList
      data={lots}
      keyExtractor={(lot) => lot.id}
      renderItem={renderLot}
      style={{ backgroundColor: t.colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          <View style={{ height: insets.top }} />
          <Card tone="brand" style={[styles.row, { gap: t.spacing.md }]}>
            <Ionicons name="map-outline" size={24} color={t.colors.brand} />
            <View style={styles.text}>
              <Text variant="bodyStrong">El mapa no está disponible</Text>
              <Text variant="micro" tone="secondary">
                Mientras tanto, elige un parqueadero de la lista. Desde su detalle puedes
                reservar y abrir la ruta en tu app de mapas.
              </Text>
            </View>
          </Card>
        </>
      }
      ListFooterComponent={<BottomSpacer extra={spacing.lg} />}
    />
  );
}

const LotRow = React.memo(function LotRow({ lot, onPress }: {
  lot: ParkingLotWithAvailability;
  onPress: (lot: ParkingLotWithAvailability) => void;
}) {
  const t = useTheme();
  const press = useCallback(() => onPress(lot), [onPress, lot]);
  return (
    <Card onPress={press} style={[styles.row, { gap: t.spacing.md }]}>
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>{lot.name}</Text>
        <Text variant="micro" tone="muted" numberOfLines={1}>
          {lot.distanceMeters != null ? `${formatDistance(lot.distanceMeters)} · ` : ''}{lot.address}
        </Text>
      </View>
      <Badge
        label={lot.availableSlots > 0 ? `${lot.availableSlots} libres` : 'Lleno'}
        tone={lot.availableSlots > 0 ? 'success' : 'danger'}
        dot
      />
    </Card>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  row:     { flexDirection: 'row', alignItems: 'center' },
  text:    { flex: 1, gap: 2 },
});
