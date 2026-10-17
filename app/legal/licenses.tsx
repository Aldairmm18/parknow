import React from 'react';
import { View } from 'react-native';
import { Card, Header, Screen, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Atribuciones de software de terceros.
 *
 * Las licencias MIT, Apache-2.0 y BSD exigen conservar el aviso de copyright en
 * las distribuciones, y las tiendas piden que sea accesible desde la app.
 */
const LICENSES = [
  { name: 'React Native', license: 'MIT', holder: 'Meta Platforms, Inc.' },
  { name: 'Expo SDK', license: 'MIT', holder: '650 Industries, Inc.' },
  { name: 'Expo Router', license: 'MIT', holder: '650 Industries, Inc.' },
  { name: 'Supabase JS', license: 'MIT', holder: 'Supabase Inc.' },
  { name: 'react-native-maps', license: 'MIT', holder: 'Airbnb, Inc. y colaboradores' },
  { name: 'react-native-svg', license: 'MIT', holder: 'Horcrux y colaboradores' },
  { name: 'react-native-qrcode-svg', license: 'MIT', holder: 'Alan Wang' },
  { name: 'date-fns', license: 'MIT', holder: 'Sasha Koss y colaboradores' },
  { name: 'Ionicons', license: 'MIT', holder: 'Ionic' },
];

export default function LicensesScreen() {
  const t = useTheme();
  return (
    <Screen scroll padded contentContainerStyle={{ gap: t.spacing.lg }}>
      <Header
        title="Licencias"
        subtitle="Software de terceros que hace funcionar ParkNow"
        back
        flat
        style={{ paddingHorizontal: 0 }}
      />

      <Card padded={false}>
        {LICENSES.map((item, index) => (
          <View
            key={item.name}
            style={{
              padding: t.spacing.lg,
              borderBottomWidth: index === LICENSES.length - 1 ? 0 : 1,
              borderBottomColor: t.colors.border,
              gap: 2,
            }}
          >
            <Text variant="bodyStrong">{item.name}</Text>
            <Text variant="micro" tone="muted">{item.license} · © {item.holder}</Text>
          </View>
        ))}
      </Card>

      <Text variant="micro" tone="muted">
        El texto completo de cada licencia está disponible en el repositorio de
        cada proyecto y en la carpeta node_modules de la distribución.
      </Text>
    </Screen>
  );
}
