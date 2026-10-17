import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { Text } from '@/components/ui/Text';
import { ParkingLotWithAvailability } from '@/domain/models';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  parking: ParkingLotWithAvailability;
  selected: boolean;
  onPress: () => void;
}

/**
 * Chincheta con la cifra de cupos libres.
 *
 * El color la hace legible de un vistazo: verde con sitio, ámbar casi lleno,
 * rojo sin cupos. Se puede leer el mapa sin tocar ningún marcador.
 */
export function ParkingMarker({ parking, selected, onPress }: Props) {
  const t = useTheme();
  if (parking.latitude == null || parking.longitude == null) return null;

  const color = parking.availableSlots === 0
    ? t.colors.danger
    : parking.occupancyPercent >= 85
      ? t.colors.warning
      : t.colors.success;

  return (
    <Marker
      coordinate={{ latitude: parking.latitude, longitude: parking.longitude }}
      onPress={onPress}
      // `tracksViewChanges` a false evita que Android redibuje la vista del
      // marcador en cada frame, que es lo que vuelve el mapa una diapositiva.
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 1 }}
      title={parking.name}
      description={`${parking.availableSlots} cupos · $${parking.pricePerBlock.toLocaleString('es-CO')}/30 min`}
    >
      <View style={styles.wrapper}>
        <View
          style={[
            styles.pin,
            {
              backgroundColor: color,
              borderRadius: t.radius.pill,
              borderColor: selected ? t.colors.textPrimary : t.palette.white,
              borderWidth: selected ? 2.5 : 2,
              transform: [{ scale: selected ? 1.12 : 1 }],
            },
            t.elevation('md'),
          ]}
        >
          <Text variant="micro" color={t.palette.white}>
            {parking.availableSlots === 0 ? 'Lleno' : parking.availableSlots}
          </Text>
        </View>
        <View style={[styles.tail, { borderTopColor: color }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  pin:     { minWidth: 34, paddingHorizontal: 9, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  tail: {
    width: 0, height: 0, marginTop: -1,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },
});
