import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, Text } from '@/components/ui';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { authService } from '@/services/authService';
import { useTheme } from '@/theme/ThemeProvider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function LoginScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Escribe tu correo.';
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'Ese correo no parece válido.';
    if (!password) next.password = 'Escribe tu contraseña.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await authService.login(email, password);
      // La redirección la decide el layout raíz al detectar la sesión.
    } catch (e: any) {
      setErrors({ form: e?.message ?? 'No se pudo iniciar sesión.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + t.spacing['2xl'], paddingBottom: insets.bottom + t.spacing['3xl'], gap: t.spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={t.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.back, { backgroundColor: t.colors.surface, borderColor: t.colors.border, borderRadius: t.radius.sm }]}
        >
          <Ionicons name="chevron-back" size={20} color={t.colors.textPrimary} />
        </Pressable>

        <View style={{ gap: t.spacing.xs }}>
          <Text variant="display">Hola de nuevo</Text>
          <Text variant="body" tone="secondary">
            Entra para ver tus reservas y tu código de acceso.
          </Text>
        </View>

        <View style={{ gap: t.spacing.md }}>
          <Field
            label="Correo electrónico"
            icon="mail-outline"
            value={email}
            onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="tu@correo.com"
            returnKeyType="next"
          />

          <Field
            label="Contraseña"
            icon="lock-closed-outline"
            value={password}
            onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
            error={errors.password}
            password
            autoComplete="current-password"
            textContentType="password"
            placeholder="Tu contraseña"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password')}
            hitSlop={t.hitSlop}
            style={{ alignSelf: 'flex-end' }}
          >
            <Text variant="caption" tone="brand">¿Olvidaste tu contraseña?</Text>
          </Pressable>

          {errors.form ? (
            <View style={[styles.alert, { backgroundColor: t.colors.dangerSoft, borderRadius: t.radius.sm, gap: t.spacing.sm }]}>
              <Ionicons name="alert-circle" size={17} color={t.colors.danger} />
              <Text variant="caption" tone="danger" style={{ flex: 1 }}>{errors.form}</Text>
            </View>
          ) : null}

          <Button label="Iniciar sesión" onPress={handleLogin} loading={loading} size="lg" />
        </View>

        <SocialAuthButtons
          disabled={loading}
          onSuccess={() => { /* El layout raíz redirige al detectar la sesión. */ }}
          onError={(message) => setErrors({ form: message })}
        />

        <Pressable onPress={() => router.replace('/(auth)/register')} style={{ alignSelf: 'center' }}>
          <Text variant="caption" tone="secondary">
            ¿No tienes cuenta? <Text variant="caption" tone="brand">Regístrate</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  back:    { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  alert:   { flexDirection: 'row', alignItems: 'center', padding: 12 },
});
