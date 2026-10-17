import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Header, Screen, Text } from '@/components/ui';
import { ThemePreference, useTheme } from '@/theme/ThemeProvider';

const OPTIONS: { value: ThemePreference; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Según el sistema', hint: 'Sigue el ajuste de tu teléfono', icon: 'phone-portrait-outline' },
  { value: 'light',  label: 'Claro',            hint: 'Siempre con fondo claro',        icon: 'sunny-outline' },
  { value: 'dark',   label: 'Oscuro',           hint: 'Siempre con fondo oscuro',       icon: 'moon-outline' },
];

export default function AppearanceScreen() {
  const t = useTheme();

  return (
    <Screen scroll padded contentContainerStyle={{ gap: t.spacing.md }}>
      <Header
        title="Apariencia"
        subtitle="Elige cómo se ve ParkNow"
        back
        flat
        style={{ paddingHorizontal: 0 }}
      />

      <Card padded={false}>
        {OPTIONS.map((option, index) => {
          const selected = t.preference === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => t.setPreference(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.row,
                {
                  gap: t.spacing.md,
                  padding: t.spacing.lg,
                  borderBottomWidth: index === OPTIONS.length - 1 ? 0 : 1,
                  borderBottomColor: t.colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.icon,
                  {
                    backgroundColor: selected ? t.colors.brandSoft : t.colors.surfaceSunken,
                    borderRadius: t.radius.md,
                  },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={18}
                  color={selected ? t.colors.brand : t.colors.textMuted}
                />
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="caption">{option.label}</Text>
                <Text variant="micro" tone="muted">{option.hint}</Text>
              </View>

              {selected ? (
                <Ionicons name="checkmark-circle" size={20} color={t.colors.brand} />
              ) : (
                <View style={[styles.emptyRadio, { borderColor: t.colors.borderStrong }]} />
              )}
            </Pressable>
          );
        })}
      </Card>

      <Text variant="micro" tone="muted">
        El tema oscuro usa las mismas relaciones de contraste que el claro, así
        que los textos siguen siendo legibles en ambos.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center' },
  icon:       { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  emptyRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
});
