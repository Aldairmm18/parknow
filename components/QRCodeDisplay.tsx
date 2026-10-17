import React from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  value: string;
  size?: number;
}

/**
 * Código QR listo para que lo lea un escáner.
 *
 * Siempre sobre blanco con módulos negros, incluso en tema oscuro: invertir un
 * QR reduce el contraste que necesitan los lectores y muchos dejan de leerlo.
 */
export function QRCodeDisplay({ value, size = 210 }: Props) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.frame,
        { borderRadius: t.radius.lg, padding: t.spacing.lg, backgroundColor: '#FFFFFF' },
        t.elevation('md'),
      ]}
    >
      <QRCode
        value={value || 'PARKNOW'}
        size={size}
        color="#000000"
        backgroundColor="#FFFFFF"
        // Nivel Q: tolera hasta un 25% de daño; útil si la pantalla tiene
        // reflejos o está parcialmente sucia.
        ecl="Q"
        quietZone={8}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center' },
});
