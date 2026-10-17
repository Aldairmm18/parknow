import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Header, LoadingState, Screen, Text } from '@/components/ui';
import { authService } from '@/services/authService';
import { userRepository } from '@/repositories/userRepository';
import { User } from '@/domain/models';
import { env } from '@/config/env';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Controles de privacidad.
 *
 * Reúne en un solo sitio los derechos que la ley reconoce al titular —acceso,
 * portabilidad, revocación del consentimiento y supresión— y que las tiendas
 * exigen que sean accesibles desde dentro de la app.
 */
export default function PrivacySettingsScreen() {
  const t = useTheme();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOptIn, setSavingOptIn] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setUser(await authService.currentUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleMarketing = async (value: boolean) => {
    if (!user) return;
    setSavingOptIn(true);
    // Optimista: el interruptor responde al instante y se revierte si falla.
    setUser({ ...user, marketingOptIn: value });
    try {
      await authService.updateProfile({ marketingOptIn: value });
    } catch (e: any) {
      setUser({ ...user, marketingOptIn: !value });
      Alert.alert('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSavingOptIn(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const data = await userRepository.exportPersonalData(user.id);
      await Share.share({
        title: 'Mis datos en ParkNow',
        message: JSON.stringify(data, null, 2),
      });
    } catch (e: any) {
      Alert.alert('No se pudo exportar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar mi cuenta',
      'Se borrarán tu perfil y tus datos personales. Las reservas ya facturadas se conservan de forma anónima por obligación contable. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            // Segunda confirmación: es irreversible y la primera se pulsa sin leer.
            Alert.alert(
              '¿Seguro?',
              'Perderás el acceso a tus reservas activas y no podrás recuperarlas.',
              [
                { text: 'No, conservar mi cuenta', style: 'cancel' },
                {
                  text: 'Sí, eliminar',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await authService.requestAccountDeletion();
                    } catch (e: any) {
                      setDeleting(false);
                      Alert.alert('No se pudo eliminar', e?.message ?? 'Escríbenos a ' + env.privacyEmail);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen>
        <Header title="Privacidad y datos" back />
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen scroll padded contentContainerStyle={{ gap: t.spacing.md }}>
      <Header
        title="Privacidad y datos"
        subtitle="Tú decides qué hacemos con tu información"
        back
        flat
        style={{ paddingHorizontal: 0 }}
      />

      <Card style={{ gap: t.spacing.md }}>
        <View style={[styles.row, { gap: t.spacing.md }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption">Novedades y promociones</Text>
            <Text variant="micro" tone="muted">
              Correos ocasionales con descuentos y funciones nuevas. Nada de esto
              afecta a los avisos de tus reservas.
            </Text>
          </View>
          <Switch
            value={user?.marketingOptIn ?? false}
            onValueChange={toggleMarketing}
            disabled={savingOptIn}
            trackColor={{ true: t.colors.brand, false: t.colors.borderStrong }}
            thumbColor={t.palette.white}
          />
        </View>
      </Card>

      <Card padded={false}>
        <ActionRow
          icon="download-outline"
          label="Descargar mis datos"
          hint="Perfil, reservas y pagos en formato JSON"
          loading={exporting}
          onPress={handleExport}
        />
        <ActionRow
          icon="location-outline"
          label="Permisos de ubicación"
          hint="Se gestionan en los ajustes del teléfono"
          onPress={() => Linking.openSettings().catch(() => {})}
        />
        <ActionRow
          icon="document-text-outline"
          label="Leer la Política de Privacidad"
          onPress={() => router.push('/legal/privacy')}
          last
        />
      </Card>

      <View style={{ gap: t.spacing.sm, marginTop: t.spacing.md }}>
        <Text variant="overline" tone="danger">Zona sensible</Text>
        <Card style={{ gap: t.spacing.md, borderColor: t.colors.danger }}>
          <View style={{ gap: 4 }}>
            <Text variant="bodyStrong">Eliminar mi cuenta</Text>
            <Text variant="micro" tone="secondary">
              Borramos tu perfil y tus datos personales en un plazo máximo de 30
              días. Escríbenos a {env.privacyEmail} si tienes dudas antes de hacerlo.
            </Text>
          </View>
          <Button
            label="Eliminar mi cuenta"
            variant="danger"
            icon="trash-outline"
            loading={deleting}
            onPress={handleDelete}
          />
        </Card>
      </View>
    </Screen>
  );
}

function ActionRow({ icon, label, hint, onPress, loading, last }: {
  icon: any; label: string; hint?: string; onPress: () => void; loading?: boolean; last?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        {
          gap: t.spacing.md,
          padding: t.spacing.lg,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: t.colors.border,
          opacity: pressed || loading ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={t.colors.textMuted} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption">{label}</Text>
        {hint ? <Text variant="micro" tone="muted">{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
