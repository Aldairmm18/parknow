import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Espacio al final de una lista o ScrollView: el área segura inferior del
 * dispositivo más `extra` (p. ej. lo que ocupa una barra de acción fija).
 *
 * Va como último hijo (o `ListFooterComponent`) en lugar de sumarse al
 * `paddingBottom` de `contentContainerStyle`: así el estilo del contenedor es
 * fijo y la lista no recalcula su layout cada vez que cambian los insets.
 */
export function BottomSpacer({ extra = 0 }: { extra?: number }) {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.bottom + extra }} />;
}
