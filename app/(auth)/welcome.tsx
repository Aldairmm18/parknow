import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button, Text } from '@/components/ui';
import { ParkingLot3D } from '@/components/three/ParkingLot3D';
import { buildFloorPlan, hash } from '@/domain/floorPlan';
import { SpotStatus } from '@/domain/enums';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Portada. La vista 3D girando sola explica de qué va la app antes que
 * cualquier texto: se ve un parqueadero, se ven los huecos libres en verde.
 */
export default function WelcomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();

  // Plano de muestra con una ocupación creíble, no todo vacío.
  const plan = React.useMemo(() => {
    const base = buildFloorPlan(1, 30, 'parknow-welcome');
    return {
      ...base,
      spots: base.spots.map((spot) => ({
        ...spot,
        status: spot.status === SpotStatus.BLOCKED
          ? SpotStatus.BLOCKED
          : hash(spot.id) % 10 < 6 ? SpotStatus.TAKEN : SpotStatus.FREE,
      })),
    };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: t.palette.brand[950] }]}>
      {/* Sólo mientras se ve: si no, el estilo claro se queda puesto en el login. */}
      {isFocused ? <StatusBar style="light" /> : null}

      <LinearGradient
        colors={[t.palette.brand[800], t.palette.brand[950], '#0B0C14']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.scene, { marginTop: insets.top }]}>
        <ParkingLot3D
          plan={plan}
          width={width}
          height={320}
          autoRotate
          minimalControls
        />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + t.spacing['2xl'], gap: t.spacing.lg }]}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="overline" color={t.palette.accent[300]}>ParkNow</Text>
          <Text variant="display" color="#FFFFFF">
            Mira el parqueadero{'\n'}antes de llegar
          </Text>
          <Text variant="body" color={t.palette.brand[200]}>
            Elige tu espacio exacto en 3D, reserva por bloques de 30 minutos y
            llega siguiendo la ruta en vivo. Sin dar vueltas.
          </Text>
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <Button
            label="Crear cuenta"
            onPress={() => router.push('/(auth)/register')}
            size="lg"
          />
          <Button
            label="Ya tengo cuenta"
            variant="ghost"
            onPress={() => router.push('/(auth)/login')}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  scene:   { alignItems: 'center' },
  content: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24 },
});
