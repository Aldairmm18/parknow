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
/** Móvil colombiano: 10 dígitos que empiezan por 3, con prefijo opcional. */
const PHONE_REGEX = /^(\+?57)?[\s-]?3\d{9}$/;
const MIN_PASSWORD = 8;

type Errors = Partial<Record<'fullName' | 'phone' | 'email' | 'password' | 'terms' | 'form', string>>;

export default function RegisterScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);

  const strength = passwordStrength(password);

  const validate = () => {
    const next: Errors = {};
    if (fullName.trim().length < 3) next.fullName = 'Escribe tu nombre y apellido.';
    if (!PHONE_REGEX.test(phone.trim())) next.phone = 'Escribe un celular colombiano de 10 dígitos.';
    if (!EMAIL_REGEX.test(email.trim())) next.email = 'Ese correo no parece válido.';
    if (password.length < MIN_PASSWORD) next.password = `Usa al menos ${MIN_PASSWORD} caracteres.`;
    else if (strength.score < 2) next.password = 'Mezcla letras, números o símbolos.';
    if (!acceptedTerms) next.terms = 'Debes aceptar los Términos y la Política de Privacidad.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const { needsEmailConfirmation } = await authService.register({
        fullName, phone, email, password, acceptedTerms,
      });
      if (needsEmailConfirmation) setSentConfirmation(true);
    } catch (e: any) {
      setErrors({ form: e?.message ?? 'No se pudo crear la cuenta.' });
    } finally {
      setLoading(false);
    }
  };

  if (sentConfirmation) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: t.colors.background, padding: t.spacing['2xl'], gap: t.spacing.lg }]}>
        <View style={[styles.bigIcon, { backgroundColor: t.colors.successSoft, borderRadius: t.radius.xl }]}>
          <Ionicons name="mail-open-outline" size={34} color={t.colors.success} />
        </View>
        <Text variant="title" center>Revisa tu correo</Text>
        <Text variant="body" tone="secondary" center>
          Te enviamos un enlace de confirmación a {email.trim().toLowerCase()}. Ábrelo
          para activar tu cuenta.
        </Text>
        <Button label="Ir a iniciar sesión" onPress={() => router.replace('/(auth)/login')} />
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
          <Text variant="display">Crea tu cuenta</Text>
          <Text variant="body" tone="secondary">Es gratis. Reserva en menos de un minuto.</Text>
        </View>

        <View style={{ gap: t.spacing.md }}>
          <Field
            label="Nombre completo"
            icon="person-outline"
            value={fullName}
            onChangeText={(v) => { setFullName(v); setErrors((e) => ({ ...e, fullName: undefined })); }}
            error={errors.fullName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            placeholder="Ana Gómez"
          />

          <Field
            label="Celular"
            icon="call-outline"
            value={phone}
            onChangeText={(v) => { setPhone(v); setErrors((e) => ({ ...e, phone: undefined })); }}
            error={errors.phone}
            hint="Lo usamos para avisarte si tu reserva está por vencer."
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder="300 123 4567"
            maxLength={17}
          />

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
          />

          <View style={{ gap: t.spacing.sm }}>
            <Field
              label="Contraseña"
              icon="lock-closed-outline"
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
              error={errors.password}
              password
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
            />
            {password.length > 0 ? <StrengthMeter score={strength.score} label={strength.label} /> : null}
          </View>

          <TermsCheckbox
            checked={acceptedTerms}
            error={errors.terms}
            onToggle={() => { setAcceptedTerms((v) => !v); setErrors((e) => ({ ...e, terms: undefined })); }}
            onOpenTerms={() => router.push('/legal/terms')}
            onOpenPrivacy={() => router.push('/legal/privacy')}
          />

          {errors.form ? (
            <View style={[styles.alert, { backgroundColor: t.colors.dangerSoft, borderRadius: t.radius.sm, gap: t.spacing.sm }]}>
              <Ionicons name="alert-circle" size={17} color={t.colors.danger} />
              <Text variant="caption" tone="danger" style={{ flex: 1 }}>{errors.form}</Text>
            </View>
          ) : null}

          <Button label="Crear cuenta" onPress={handleRegister} loading={loading} size="lg" />
        </View>

        <SocialAuthButtons
          disabled={loading}
          dividerLabel="o regístrate con"
          onSuccess={() => { /* El layout raíz redirige al detectar la sesión. */ }}
          onError={(message) => setErrors({ form: message })}
        />

        <Pressable onPress={() => router.replace('/(auth)/login')} style={{ alignSelf: 'center' }}>
          <Text variant="caption" tone="secondary">
            ¿Ya tienes cuenta? <Text variant="caption" tone="brand">Inicia sesión</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Consentimiento explícito y registrado.
 *
 * No va premarcado: tanto el RGPD como la Ley 1581 de 2012 exigen que la
 * autorización sea una acción afirmativa del titular. `authService.register`
 * guarda la marca de tiempo de esta aceptación.
 */
function TermsCheckbox({ checked, error, onToggle, onOpenTerms, onOpenPrivacy }: {
  checked: boolean; error?: string; onToggle: () => void;
  onOpenTerms: () => void; onOpenPrivacy: () => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="Acepto los Términos y la Política de Privacidad"
        style={[styles.termsRow, { gap: t.spacing.md }]}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderRadius: t.radius.xs,
              backgroundColor: checked ? t.colors.brand : 'transparent',
              borderColor: checked ? t.colors.brand : error ? t.colors.danger : t.colors.borderStrong,
            },
          ]}
        >
          {checked ? <Ionicons name="checkmark" size={14} color={t.colors.textOnBrand} /> : null}
        </View>
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          Acepto los{' '}
          <Text variant="caption" tone="brand" onPress={onOpenTerms}>Términos del Servicio</Text>
          {' '}y la{' '}
          <Text variant="caption" tone="brand" onPress={onOpenPrivacy}>Política de Privacidad</Text>.
        </Text>
      </Pressable>
      {error ? <Text variant="micro" tone="danger">{error}</Text> : null}
    </View>
  );
}

function StrengthMeter({ score, label }: { score: number; label: string }) {
  const t = useTheme();
  const colors = [t.colors.danger, t.colors.danger, t.colors.warning, t.colors.success, t.colors.success];
  return (
    <View style={{ gap: 5 }}>
      <View style={[styles.meter, { gap: 4 }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1, height: 3, borderRadius: 2,
              backgroundColor: i < score ? colors[score] : t.colors.surfaceSunken,
            }}
          />
        ))}
      </View>
      <Text variant="micro" color={colors[score]}>{label}</Text>
    </View>
  );
}

/**
 * Fuerza de la contraseña por variedad y longitud.
 *
 * Es una heurística para guiar al usuario, no una política de seguridad: la
 * comprobación que manda es la del servidor de Supabase.
 */
function passwordStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  score = Math.min(4, score);
  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];
  return { score, label: labels[score] };
}

const styles = StyleSheet.create({
  root:      { flex: 1 },
  centered:  { alignItems: 'center', justifyContent: 'center' },
  content:   { flexGrow: 1, paddingHorizontal: 24 },
  back:      { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  alert:     { flexDirection: 'row', alignItems: 'center', padding: 12 },
  termsRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  checkbox:  { width: 22, height: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  meter:     { flexDirection: 'row' },
  bigIcon:   { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
});
