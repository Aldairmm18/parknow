import React from 'react';
import { ScrollView, ScrollViewProps, StatusBar, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  children: React.ReactNode;
  /** Envuelve el contenido en un ScrollView con el padding inferior seguro. */
  scroll?: boolean;
  /** Espacio extra al final, p. ej. para una barra de acción fija. */
  footerSpace?: number;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style'>;
}

/** Contenedor base: fondo del tema, barra de estado coherente y áreas seguras. */
export function Screen({
  children, scroll, footerSpace = 0, padded, style, contentContainerStyle, scrollProps,
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const body = (
    <>
      <StatusBar
        barStyle={t.colors.statusBar === 'light' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      {children}
    </>
  );

  if (!scroll) {
    return <View style={[styles.flex, { backgroundColor: t.colors.background }, style]}>{body}</View>;
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.background }, style]}>
      <StatusBar
        barStyle={t.colors.statusBar === 'light' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <ScrollView
        {...scrollProps}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          padded && { paddingHorizontal: t.spacing.lg },
          { paddingBottom: insets.bottom + t.spacing.xl + footerSpace },
          contentContainerStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
