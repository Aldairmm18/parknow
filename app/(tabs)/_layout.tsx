import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index',    title: 'Buscar',   icon: 'search-outline',   iconActive: 'search' },
  { name: 'mapa',     title: 'Mapa',     icon: 'map-outline',      iconActive: 'map' },
  { name: 'reservas', title: 'Reservas', icon: 'ticket-outline',   iconActive: 'ticket' },
  { name: 'perfil',   title: 'Perfil',   icon: 'person-outline',   iconActive: 'person' },
];

export default function TabLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.brand,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
          ...t.elevation('sm'),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarHideOnKeyboard: Platform.OS === 'android',
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconWrap}>
                <Ionicons
                  name={focused ? tab.iconActive : tab.icon}
                  color={color}
                  size={focused ? 23 : 22}
                />
                {/* Punto bajo el icono activo: refuerza el estado sin depender
                    sólo del color, que es lo que pide la accesibilidad. */}
                {focused ? (
                  <View style={[styles.dot, { backgroundColor: t.colors.brand }]} />
                ) : null}
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  dot:      { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: -6 },
});
