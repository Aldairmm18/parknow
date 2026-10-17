import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Text } from '@/components/ui';
import { checkEventService } from '@/services/reservationService';
import { floorLabelFor, spotLabelFor } from '@/domain/floorPlan';
import { useTheme } from '@/theme/ThemeProvider';

type Mode = 'entry' | 'exit';
type Result = { ok: boolean; title: string; message: string } | null;

const { width } = Dimensions.get('window');
const FRAME_SIZE = Math.min(width * 0.7, 280);

type Validation = Awaited<ReturnType<typeof checkEventService.validateEntry>>;

/** Convierte la validación en el texto de la tarjeta de resultado. */
function describeResult(mode: Mode, validation: Validation): Result {
  if (!validation.success) {
    return { ok: false, title: 'Acceso denegado', message: validation.reason ?? 'Este código no es válido.' };
  }
  const r = validation.reservation;
  return {
    ok: true,
    title: mode === 'entry' ? 'Acceso permitido' : 'Salida registrada',
    message: r?.assignedFloor != null
      ? `${floorLabelFor(r.assignedFloor)} · ${spotLabelFor(r.assignedSpot ?? 0)} · ${r.vehiclePlate}`
      : 'Registro completado correctamente.',
  };
}

/** Estado del lector: modo, resultado y la validación de cada lectura. */
function useQrScanner() {
  const [mode, setModeState] = useState<Mode>('entry');
  const [result, setResult] = useState<Result>(null);
  const [processing, setProcessing] = useState(false);
  // Evita que el mismo código dispare varias validaciones mientras la cámara
  // sigue emitiendo fotogramas con el QR dentro del encuadre.
  const lockRef = useRef(false);

  const handleScan = useCallback(async ({ data }: { data: string }) => {
    if (lockRef.current || processing) return;
    lockRef.current = true;
    setProcessing(true);

    try {
      const validation = mode === 'entry'
        ? await checkEventService.validateEntry(data)
        : await checkEventService.validateExit(data);

      Haptics.notificationAsync(
        validation.success
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      ).catch(() => {});

      setResult(describeResult(mode, validation));
    } catch (e: any) {
      setResult({ ok: false, title: 'Error', message: e?.message ?? 'No se pudo leer el código.' });
    } finally {
      setProcessing(false);
    }
  }, [mode, processing]);

  const scanAgain = useCallback(() => {
    setResult(null);
    lockRef.current = false;
  }, []);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    scanAgain();
  }, [scanAgain]);

  return { mode, setMode, result, processing, handleScan, scanAgain };
}

/**
 * Lector de códigos QR de entrada y salida.
 *
 * Está pensado para el personal del parqueadero: el usuario final muestra su
 * código, no lo escanea. Por eso el resultado se presenta como una tarjeta
 * grande y de color inequívoco, legible a un brazo de distancia.
 */
export default function ScannerScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const { mode, setMode, result, processing, handleScan, scanAgain } = useQrScanner();

  if (!permission) {
    return <View style={[styles.root, { backgroundColor: t.palette.neutral[950] }]} />;
  }

  if (!permission.granted) {
    return <CameraPermissionPrompt onAllow={requestPermission} onDismiss={() => router.back()} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>
      <StatusBar style="light" />

      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={result ? undefined : handleScan}
      />

      {/* Máscara con el recuadro de enfoque recortado. */}
      <View style={styles.mask} pointerEvents="none">
        <View style={styles.maskRow} />
        <View style={styles.maskMiddle}>
          <View style={styles.maskRow} />
          <View style={[styles.frame, { width: FRAME_SIZE, height: FRAME_SIZE }]}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <View key={corner} style={[styles.corner, cornerStyles[corner], { borderColor: t.palette.brand[300] }]} />
            ))}
          </View>
          <View style={styles.maskRow} />
        </View>
        <View style={styles.maskRow} />
      </View>

      {/* Cabecera */}
      <View style={[styles.header, { top: insets.top + t.spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={[styles.roundBtn, { backgroundColor: t.alpha(t.palette.black, 0.55) }]}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>

        <View style={[styles.modeSwitch, { backgroundColor: t.alpha(t.palette.black, 0.55), borderRadius: t.radius.pill }]}>
          <ModeTab label="Entrada" active={mode === 'entry'} onPress={() => setMode('entry')} />
          <ModeTab label="Salida" active={mode === 'exit'} onPress={() => setMode('exit')} />
        </View>

        <View style={styles.roundBtn} />
      </View>

      {/* Resultado o instrucción */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + t.spacing.xl, gap: t.spacing.md }]}>
        {result ? (
          <ScanResultCard result={result} onScanAgain={scanAgain} />
        ) : (
          <ScanHint processing={processing} mode={mode} />
        )}
      </View>
    </View>
  );
}

function CameraPermissionPrompt({ onAllow, onDismiss }: { onAllow: () => void; onDismiss: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.root, styles.centered, { backgroundColor: t.colors.background, padding: t.spacing['2xl'], gap: t.spacing.lg }]}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <View style={[styles.bigIcon, { backgroundColor: t.colors.brandSoft, borderRadius: t.radius.xl }]}>
        <Ionicons name="camera-outline" size={32} color={t.colors.brand} />
      </View>
      <Text variant="title" center>Necesitamos la cámara</Text>
      <Text variant="body" tone="secondary" center>
        Sólo la usamos para leer los códigos QR de acceso. No guardamos ninguna
        imagen ni grabamos vídeo.
      </Text>
      <View style={[styles.stretch, { gap: t.spacing.sm }]}>
        <Button label="Permitir cámara" onPress={onAllow} size="lg" />
        <Button label="Ahora no" variant="ghost" onPress={onDismiss} />
      </View>
    </View>
  );
}

function ScanResultCard({ result, onScanAgain }: { result: NonNullable<Result>; onScanAgain: () => void }) {
  const t = useTheme();
  const tone = result.ok
    ? { border: t.colors.success, soft: t.colors.successSoft, icon: 'checkmark-circle' as const, text: 'success' as const }
    : { border: t.colors.danger, soft: t.colors.dangerSoft, icon: 'close-circle' as const, text: 'danger' as const };
  return (
    <Card elevation="lg" style={{ gap: t.spacing.md, borderColor: tone.border, borderWidth: 1.5 }}>
      <View style={[styles.row, { gap: t.spacing.md }]}>
        <View style={[styles.bigIcon, { backgroundColor: tone.soft, borderRadius: t.radius.lg }]}>
          <Ionicons name={tone.icon} size={30} color={tone.border} />
        </View>
        <View style={styles.resultText}>
          <Text variant="heading" tone={tone.text}>{result.title}</Text>
          <Text variant="caption" tone="secondary">{result.message}</Text>
        </View>
      </View>
      <Button label="Escanear otro" icon="scan-outline" onPress={onScanAgain} />
    </Card>
  );
}

function ScanHint({ processing, mode }: { processing: boolean; mode: Mode }) {
  const t = useTheme();
  return (
    <View style={[styles.hint, { backgroundColor: t.alpha(t.palette.black, 0.6), borderRadius: t.radius.md, gap: t.spacing.sm }]}>
      <Ionicons name={processing ? 'sync' : 'qr-code-outline'} size={18} color={t.palette.brand[300]} />
      <Text variant="caption" color="#fff" style={styles.flex}>
        {processing
          ? 'Validando el código…'
          : `Apunta al código QR de ${mode === 'entry' ? 'entrada' : 'salida'}`}
      </Text>
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[
        styles.modeTab,
        { borderRadius: t.radius.pill, backgroundColor: active ? t.colors.brand : 'transparent' },
      ]}
    >
      <Text variant="micro" color={active ? '#fff' : t.alpha('#FFFFFF', 0.7)}>{label}</Text>
    </Pressable>
  );
}

const CORNER = 26;
const cornerStyles = StyleSheet.create({
  tl: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  tr: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
  br: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },
});

const styles = StyleSheet.create({
  root:       { flex: 1 },
  centered:   { alignItems: 'center', justifyContent: 'center' },
  mask:       { ...StyleSheet.absoluteFillObject },
  maskRow:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  maskMiddle: { flexDirection: 'row', height: FRAME_SIZE },
  frame:      { position: 'relative' },
  corner:     { position: 'absolute', width: CORNER, height: CORNER },
  header:     { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modeSwitch: { flexDirection: 'row', padding: 3, gap: 2 },
  modeTab:    { paddingHorizontal: 18, paddingVertical: 7 },
  bottom:     { position: 'absolute', left: 16, right: 16, bottom: 0 },
  hint:       { flexDirection: 'row', alignItems: 'center', padding: 14 },
  row:        { flexDirection: 'row', alignItems: 'center' },
  bigIcon:    { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  stretch:    { alignSelf: 'stretch' },
  resultText: { flex: 1, gap: 2 },
  flex:       { flex: 1 },
});
