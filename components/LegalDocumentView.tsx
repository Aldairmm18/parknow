import React from 'react';
import { StyleSheet, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge, Header, Screen, Text } from '@/components/ui';
import { LegalDocument } from '@/constants/legal';
import { useTheme } from '@/theme/ThemeProvider';

/** Renderiza un documento legal con jerarquía legible y viñetas reales. */
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  const t = useTheme();

  return (
    <Screen scroll padded contentContainerStyle={{ gap: t.spacing.xl }}>
      <Header title={document.title} subtitle={document.subtitle} back flat style={{ paddingHorizontal: 0 }} />

      <View style={[styles.meta, { gap: t.spacing.sm }]}>
        <Badge
          label={`Actualizado el ${format(parseISO(document.lastUpdated), "d 'de' MMMM 'de' yyyy", { locale: es })}`}
          icon="time-outline"
        />
        <Badge label={`v${document.version}`} tone="brand" />
      </View>

      {document.sections.map((section) => (
        <View key={section.heading} style={{ gap: t.spacing.sm }}>
          <Text variant="heading">{section.heading}</Text>
          {section.paragraphs.map((paragraph) => {
            const isBullet = paragraph.startsWith('• ');
            return (
              <View
                key={paragraph}
                style={isBullet ? [styles.bulletRow, { gap: t.spacing.sm }] : undefined}
              >
                {isBullet ? (
                  <View style={[styles.bullet, { backgroundColor: t.colors.brand, marginTop: 8 }]} />
                ) : null}
                <Text
                  variant="body"
                  tone="secondary"
                  style={isBullet ? { flex: 1 } : undefined}
                >
                  {isBullet ? paragraph.slice(2) : paragraph}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta:      { flexDirection: 'row', flexWrap: 'wrap' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bullet:    { width: 5, height: 5, borderRadius: 3 },
});
