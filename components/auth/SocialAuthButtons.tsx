import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { authService } from '@/services/authService';

type Provider = 'google' | 'facebook' | 'apple';

interface Props {
  onStart?: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
  /** Texto del separador; `null` lo oculta. */
  dividerLabel?: string | null;
}

/**
 * Inicio de sesión con Google, Facebook y Apple.
 *
 * El botón de Apple sólo aparece en iOS 13+. Es una exigencia de la App Store
 * (guía 4.8): si ofreces inicio de sesión con terceros, debes ofrecer también
 * el de Apple — pero únicamente en dispositivos Apple.
 */
export function SocialAuthButtons({ onStart, onSuccess, onError, disabled, dividerLabel = 'o continúa con' }: Props) {
  const t = useTheme();
  const [pending, setPending] = useState<Provider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    authService.isAppleSignInAvailable().then((ok) => { if (active) setAppleAvailable(ok); });
    return () => { active = false; };
  }, []);

  const run = async (provider: Provider) => {
    if (pending || disabled) return;
    setPending(provider);
    onStart?.();
    try {
      if (provider === 'google') await authService.signInWithGoogle();
      else if (provider === 'facebook') await authService.signInWithFacebook();
      else await authService.signInWithApple();
      onSuccess();
    } catch (e: any) {
      // Cerrar la ventana del proveedor es una decisión del usuario, no un error.
      if (e?.name !== 'AuthCancelledError') {
        onError(e?.message ?? 'No se pudo iniciar sesión con ese proveedor.');
      }
    } finally {
      setPending(null);
    }
  };

  return (
    <View style={{ gap: t.spacing.md }}>
      {dividerLabel ? (
        <View style={[styles.divider, { gap: t.spacing.md, marginVertical: t.spacing.xs }]}>
          <View style={[styles.line, { backgroundColor: t.colors.border }]} />
          <Text variant="micro" tone="muted">{dividerLabel}</Text>
          <View style={[styles.line, { backgroundColor: t.colors.border }]} />
        </View>
      ) : null}

      <View style={{ gap: t.spacing.sm }}>
        <ProviderButton
          label="Continuar con Google"
          loading={pending === 'google'}
          disabled={disabled || (pending != null && pending !== 'google')}
          onPress={() => run('google')}
          icon={<GoogleMark />}
        />

        <ProviderButton
          label="Continuar con Facebook"
          loading={pending === 'facebook'}
          disabled={disabled || (pending != null && pending !== 'facebook')}
          onPress={() => run('facebook')}
          icon={<FacebookMark />}
        />

        {appleAvailable && Platform.OS === 'ios' ? (
          <ProviderButton
            label="Continuar con Apple"
            loading={pending === 'apple'}
            disabled={disabled || (pending != null && pending !== 'apple')}
            onPress={() => run('apple')}
            icon={<Ionicons name="logo-apple" size={19} color={t.colors.textPrimary} />}
          />
        ) : null}
      </View>
    </View>
  );
}

function ProviderButton({ label, icon, onPress, loading, disabled }: {
  label: string; icon: React.ReactNode; onPress: () => void; loading?: boolean; disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.btn,
        {
          height: 50,
          borderRadius: t.radius.md,
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.iconSlot}>
        {loading ? <ActivityIndicator size="small" color={t.colors.textSecondary} /> : icon}
      </View>
      <Text variant="bodyStrong">{label}</Text>
      {/* Hueco simétrico al del icono para que el texto quede centrado. */}
      <View style={styles.iconSlot} />
    </Pressable>
  );
}

/** Logotipo oficial de Google en sus cuatro colores de marca. */
function GoogleMark() {
  return (
    <Svg width={19} height={19} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.3-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.2 5.2C41 35.5 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

function FacebookMark() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c-3.01 0-5.32 1.84-5.32 5.24v2.97h-3.3V24h3.3v-8.44h3.05v8.44C19.61 23.09 24 18.1 24 12.07z"
      />
      <Path
        fill="#1877F2"
        d="M16.67 15.56l.53-3.49h-3.33V9.81c0-.95.47-1.88 1.96-1.88h1.52V4.96s-1.38-.24-2.7-.24c-2.76 0-4.56 1.67-4.56 4.7v2.65H7.08v3.49h3.01V24a12.1 12.1 0 003.75 0v-8.44h2.83z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  divider:  { flexDirection: 'row', alignItems: 'center' },
  line:     { flex: 1, height: 1 },
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, paddingHorizontal: 16 },
  iconSlot: { width: 22, alignItems: 'center' },
});
