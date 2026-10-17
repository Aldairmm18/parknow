import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, Text } from '@/components/ui';
import { authService } from '@/services/authService';
import { useTheme } from '@/theme/ThemeProvider';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPasswordScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Ese correo no parece válido.');
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      await authService.sendPasswordReset(email);
      // Se confirma el envío pase lo que pase: decir "ese correo no existe"
      // permitiría averiguar quién tiene cuenta en la app.
      setSent(true);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo enviar el correo.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: t.colors.background, padding: t.spacing['2xl'], gap: t.spacing.lg }]}>
        <View style={[styles.bigIcon, { backgroundColor: t.colors.brandSoft, borderRadius: t.radius.xl }]}>
          <Ionicons name="paper-plane-outline" size={32} color={t.colors.brand} />
        </View>
        <Text variant="title" center>Correo enviado</Text>
        <Text variant="body" tone="secondary" center>
          Si {email.trim().toLowerCase()} tiene una cuenta, recibirás un enlace para
          crear una contraseña nueva. Revisa también el correo no deseado.
        </Text>
        <Button label="Volver" onPress={() => router.back()} variant="secondary" />
      </View>
    );
  }

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
          <Text variant="display">Recupera tu acceso</Text>
          <Text variant="body" tone="secondary">
            Escribe tu correo y te enviamos un enlace para restablecer la contraseña.
          </Text>
        </View>

        <Field
          label="Correo electrónico"
          icon="mail-outline"
          value={email}
          onChangeText={(v) => { setEmail(v); setError(undefined); }}
          error={error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="tu@correo.com"
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        <Button label="Enviar enlace" onPress={handleSend} loading={loading} size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content:  { flexGrow: 1, paddingHorizontal: 24 },
  back:     { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  bigIcon:  { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
});
