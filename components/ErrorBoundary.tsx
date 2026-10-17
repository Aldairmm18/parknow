import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@/components/ui';
import { useTheme } from '@/theme/ThemeProvider';
import { env } from '@/config/env';

interface State {
  error: Error | null;
}

/**
 * Última red de seguridad ante un fallo de render.
 *
 * Sin esto, cualquier excepción no capturada en un componente deja la app en
 * blanco en producción, sin forma de recuperarse salvo cerrarla. Aquí al menos
 * se explica qué pasó y se ofrece reintentar.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Punto de enganche para el servicio de reporte de errores (Sentry,
    // Bugsnag…). En desarrollo basta con la consola.
    if (__DEV__) console.error('Fallo no capturado:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return <Fallback error={this.state.error} onReset={this.reset} />;
  }
}

function Fallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: t.colors.background, padding: t.spacing['2xl'], gap: t.spacing.lg },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: t.colors.dangerSoft, borderRadius: t.radius.xl }]}>
        <Ionicons name="bug-outline" size={32} color={t.colors.danger} />
      </View>

      <Text variant="title" center>Algo se rompió</Text>
      <Text variant="body" tone="secondary" center>
        La app encontró un error inesperado. Puedes reintentar; si vuelve a
        ocurrir, escríbenos a {env.supportEmail}.
      </Text>

      {__DEV__ ? (
        <View
          style={{
            backgroundColor: t.colors.surfaceSunken,
            borderRadius: t.radius.sm,
            padding: t.spacing.md,
            alignSelf: 'stretch',
          }}
        >
          <Text variant="micro" tone="danger">{error.message}</Text>
        </View>
      ) : null}

      <Button label="Reintentar" icon="refresh" onPress={onReset} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
});
