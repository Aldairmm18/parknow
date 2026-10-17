import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

interface Props extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Botón al final del campo (ojo de contraseña, limpiar…). */
  trailing?: React.ReactNode;
  /** Marca el campo como de contraseña con el conmutador de visibilidad. */
  password?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Field({
  label, hint, error, icon, trailing, password, containerStyle, ...input
}: Props) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const active = focused || Boolean(error);
  const borderColor = error ? t.colors.danger : focused ? t.colors.brand : t.colors.border;

  return (
    <View style={[{ gap: 6 }, containerStyle]}>
      {label ? <Text variant="caption" tone="secondary">{label}</Text> : null}

      <View
        style={[
          styles.box,
          {
            backgroundColor: t.colors.surface,
            borderColor,
            borderRadius: t.radius.md,
            borderWidth: active ? 1.5 : 1,
            paddingHorizontal: t.spacing.md,
          },
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={focused ? t.colors.brand : t.colors.textMuted} />
        ) : null}

        <TextInput
          {...input}
          secureTextEntry={password ? hidden : input.secureTextEntry}
          placeholderTextColor={t.colors.textMuted}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          accessibilityLabel={input.accessibilityLabel ?? label}
          style={[
            styles.input,
            { color: t.colors.textPrimary, ...t.typography.body },
          ]}
        />

        {password ? <PasswordToggle hidden={hidden} onToggle={() => setHidden((h) => !h)} /> : trailing}
      </View>

      <FieldMessage error={error} hint={hint} />
    </View>
  );
}

function PasswordToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={t.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
    >
      <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={t.colors.textMuted} />
    </Pressable>
  );
}

/** El error manda sobre la ayuda: si hay error, la pista se oculta. */
function FieldMessage({ error, hint }: { error?: string; hint?: string }) {
  const t = useTheme();
  if (error) {
    return (
      <View style={styles.msgRow}>
        <Ionicons name="alert-circle" size={13} color={t.colors.danger} />
        <Text variant="micro" tone="danger" style={styles.msgText}>{error}</Text>
      </View>
    );
  }
  return hint ? <Text variant="micro" tone="muted">{hint}</Text> : null;
}

const styles = StyleSheet.create({
  box:    { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 },
  input:  { flex: 1, paddingVertical: 13, padding: 0 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  msgText: { flex: 1 },
});
