import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Header, LoadingState, Screen, Text } from '@/components/ui';
import { authService } from '@/services/authService';
import { User } from '@/domain/models';
import { AuthProvider } from '@/domain/enums';
import { env } from '@/config/env';
import { useTheme } from '@/theme/ThemeProvider';

const PROVIDER_LABEL: Record<AuthProvider, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  [AuthProvider.EMAIL]:    { label: 'Correo y contraseña', icon: 'mail-outline' },
  [AuthProvider.GOOGLE]:   { label: 'Google', icon: 'logo-google' },
  [AuthProvider.FACEBOOK]: { label: 'Facebook', icon: 'logo-facebook' },
  [AuthProvider.APPLE]:    { label: 'Apple', icon: 'logo-apple' },
};

export default function PerfilScreen() {
  const t = useTheme();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      setUser(await authService.currentUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await authService.logout();
          } catch {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <Header title="Mi cuenta" />
        <LoadingState />
      </Screen>
    );
  }

  const provider = PROVIDER_LABEL[user?.authProvider ?? AuthProvider.EMAIL];
  const initials = (user?.fullName ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <Screen scroll padded contentContainerStyle={{ gap: t.spacing.md }}>
      <Header title="Mi cuenta" flat style={{ paddingHorizontal: 0 }} />

      {/* Identidad */}
      <Card elevation="md" style={[styles.row, { gap: t.spacing.lg }]}>
        <View style={[styles.avatar, { backgroundColor: t.colors.brand, borderRadius: t.radius.full }]}>
          <Text variant="heading" color={t.colors.textOnBrand}>{initials || '?'}</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="heading" numberOfLines={1}>{user?.fullName || 'Usuario'}</Text>
          <Text variant="micro" tone="muted" numberOfLines={1}>{user?.email}</Text>
          <Badge label={provider.label} icon={provider.icon} style={{ marginTop: 2 }} />
        </View>
      </Card>

      {/* Datos personales */}
      <Section title="Datos personales">
        <Row icon="person-outline" label="Nombre" value={user?.fullName || '—'} />
        <Row icon="mail-outline" label="Correo" value={user?.email || '—'} />
        <Row icon="call-outline" label="Celular" value={user?.phone || 'Sin registrar'} last />
      </Section>

      {/* Ajustes */}
      <Section title="Preferencias">
        <NavRow
          icon="color-palette-outline"
          label="Apariencia"
          hint={{ system: 'Según el sistema', light: 'Claro', dark: 'Oscuro' }[t.preference]}
          onPress={() => router.push('/settings/appearance')}
        />
        <NavRow
          icon="shield-checkmark-outline"
          label="Privacidad y datos"
          onPress={() => router.push('/settings/privacy')}
          last
        />
      </Section>

      {/* Legal y soporte */}
      <Section title="Legal y soporte">
        <NavRow
          icon="document-text-outline"
          label="Términos del Servicio"
          onPress={() => router.push('/legal/terms')}
        />
        <NavRow
          icon="lock-closed-outline"
          label="Política de Privacidad"
          onPress={() => router.push('/legal/privacy')}
        />
        <NavRow
          icon="code-slash-outline"
          label="Licencias de terceros"
          onPress={() => router.push('/legal/licenses')}
        />
        <NavRow
          icon="help-buoy-outline"
          label="Contactar soporte"
          hint={env.supportEmail}
          onPress={() =>
            Linking.openURL(
              `mailto:${env.supportEmail}?subject=${encodeURIComponent(`Soporte ParkNow ${env.appVersion}`)}`,
            ).catch(() => {})}
          last
        />
      </Section>

      <Button
        label="Cerrar sesión"
        variant="danger"
        icon="log-out-outline"
        loading={loggingOut}
        onPress={handleLogout}
      />

      <Text variant="micro" tone="muted" center style={{ marginTop: t.spacing.sm }}>
        ParkNow {env.appVersion} ({env.buildNumber})
      </Text>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.sm }}>
      <Text variant="overline" tone="muted">{title}</Text>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

function Row({ icon, label, value, last }: {
  icon: any; label: string; value: string; last?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.rowItem,
        { gap: t.spacing.md, padding: t.spacing.lg, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.colors.border },
      ]}
    >
      <Ionicons name={icon} size={18} color={t.colors.textMuted} />
      <Text variant="caption" tone="secondary" style={{ flex: 1 }}>{label}</Text>
      <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

function NavRow({ icon, label, hint, onPress, last }: {
  icon: any; label: string; hint?: string; onPress: () => void; last?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.rowItem,
        {
          gap: t.spacing.md,
          padding: t.spacing.lg,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: t.colors.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={t.colors.textMuted} />
      <Text variant="caption" style={{ flex: 1 }}>{label}</Text>
      {hint ? <Text variant="micro" tone="muted" numberOfLines={1}>{hint}</Text> : null}
      <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center' },
  avatar:  { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  rowItem: { flexDirection: 'row', alignItems: 'center' },
});
