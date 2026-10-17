import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Polygon, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  box, Camera, createCamera, Face, hitTest, plane, PITCH_MAX, PITCH_MIN,
  RenderedFace, renderFaces, v3, Vec2,
} from '@/lib/engine3d';
import { FloorPlan, Spot } from '@/domain/floorPlan';
import { SpotKind, SpotStatus } from '@/domain/enums';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';

interface Props {
  plan: FloorPlan;
  selectedSpotId?: string | null;
  onSelectSpot?: (spot: Spot) => void;
  width: number;
  height: number;
  /** Deja la escena girando sola hasta el primer toque. */
  autoRotate?: boolean;
  /** Oculta los controles de zoom y reencuadre. */
  minimalControls?: boolean;
}

type FaceMeta = { spotId: string };

const INITIAL_YAW = -0.42;
const INITIAL_PITCH = 0.78;
const MIN_DISTANCE = 26;
const MAX_DISTANCE = 92;

/**
 * Vista 3D de una planta del parqueadero.
 *
 * Se puede orbitar arrastrando, acercar con dos dedos o con los botones, y
 * tocar un espacio para seleccionarlo. Mientras se arrastra, la escena se
 * dibuja en modo simplificado (sin coches ni etiquetas) para que el giro siga
 * al dedo; al soltar se repinta completa.
 */
export function ParkingLot3D({
  plan, selectedSpotId, onSelectSpot, width, height, autoRotate = true, minimalControls,
}: Props) {
  const t = useTheme();

  const [yaw, setYaw] = useState(INITIAL_YAW);
  const [pitch, setPitch] = useState(INITIAL_PITCH);
  const [distance, setDistance] = useState(() =>
    clamp(Math.max(plan.width, plan.depth) * 1.35, MIN_DISTANCE, MAX_DISTANCE));
  const [dragging, setDragging] = useState(false);

  // Refs para que el PanResponder lea siempre el valor vigente sin recrearse.
  const yawRef = useRef(yaw);
  const pitchRef = useRef(pitch);
  const distanceRef = useRef(distance);
  const pinchRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  useLayoutEffect(() => {
    yawRef.current = yaw; pitchRef.current = pitch; distanceRef.current = distance;
  }, [yaw, pitch, distance]);

  const renderedRef = useRef<RenderedFace<FaceMeta>[]>([]);
  const [interacted, setInteracted] = useState(false);

  useAutoRotate(autoRotate && !interacted && !dragging, setYaw);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.hypot(g.dx, g.dy) > 3,
        onPanResponderGrant: () => {
          movedRef.current = false;
          pinchRef.current = null;
          setDragging(true);
          setInteracted(true);
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            // Pellizco: la variación de la separación entre dedos mueve la
            // cámara en el eje de profundidad.
            const span = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            );
            if (pinchRef.current != null && pinchRef.current > 0) {
              const ratio = pinchRef.current / span;
              setDistance((d) => clamp(d * ratio, MIN_DISTANCE, MAX_DISTANCE));
            }
            pinchRef.current = span;
            movedRef.current = true;
            return;
          }

          pinchRef.current = null;
          if (Math.hypot(gesture.dx, gesture.dy) > 6) movedRef.current = true;

          // 360° por cada ancho de pantalla arrastrado se siente natural.
          setYaw(yawRef.current + (gesture.dx / width) * Math.PI * 1.6);
          setPitch(clamp(pitchRef.current - (gesture.dy / height) * 1.6, PITCH_MIN, PITCH_MAX));
        },
        onPanResponderRelease: (event) => {
          setDragging(false);
          pinchRef.current = null;
          if (movedRef.current) return;
          // Un toque sin arrastre es una selección.
          const { locationX, locationY } = event.nativeEvent;
          handleTap({ x: locationX, y: locationY });
        },
        onPanResponderTerminate: () => { setDragging(false); pinchRef.current = null; },
      }),
    // `handleTap` se lee de una ref implícita vía closure sobre renderedRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height],
  );

  const camera = useMemo<Camera>(
    () => createCamera({
      yaw, pitch, distance, width, height,
      fov: Math.PI / 4.4,
      target: v3(0, 1.2, 0),
    }),
    [yaw, pitch, distance, width, height],
  );

  const spotColors = useSpotColors();

  const faces = useMemo(
    () => buildScene({ plan, camera, colors: spotColors, selectedSpotId, simplified: dragging, theme: t }),
    [plan, camera, spotColors, selectedSpotId, dragging, t],
  );

  const rendered = useMemo(
    () => renderFaces<FaceMeta>(faces, camera, { mix: t.mix, ambient: 0.58 }),
    [faces, camera, t.mix],
  );
  useLayoutEffect(() => { renderedRef.current = rendered; }, [rendered]);

  const handleTap = useCallback((point: Vec2) => {
    const hit = hitTest(point, renderedRef.current);
    if (!hit?.meta) return;
    const spot = plan.spots.find((s) => s.id === hit.meta!.spotId);
    if (!spot || spot.status === SpotStatus.BLOCKED || spot.status === SpotStatus.TAKEN) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSelectSpot?.(spot);
  }, [plan.spots, onSelectSpot]);

  const resetView = () => {
    setYaw(INITIAL_YAW);
    setPitch(INITIAL_PITCH);
    setDistance(clamp(Math.max(plan.width, plan.depth) * 1.35, MIN_DISTANCE, MAX_DISTANCE));
    setInteracted(true);
  };

  return (
    <View style={{ width, height }}>
      <View {...panResponder.panHandlers} style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.scheme === 'dark' ? '#1B1D28' : t.palette.brand[100]} />
              <Stop offset="1" stopColor={t.scheme === 'dark' ? '#101117' : t.palette.neutral[50]} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />

          <G>
            {rendered.map((face) => (
              <Polygon
                key={face.key}
                points={face.points}
                fill={face.fill}
                fillOpacity={face.opacity}
                stroke={face.stroke}
                strokeWidth={face.strokeWidth}
                strokeLinejoin="round"
              />
            ))}
          </G>

          {!dragging && (
            <SpotLabels plan={plan} camera={camera} selectedSpotId={selectedSpotId} />
          )}
        </Svg>
      </View>

      {!minimalControls && (
        <View style={[styles.controls, { gap: t.spacing.sm }]} pointerEvents="box-none">
          <ControlButton icon="add" onPress={() => { setInteracted(true); setDistance((d) => clamp(d * 0.82, MIN_DISTANCE, MAX_DISTANCE)); }} label="Acercar" />
          <ControlButton icon="remove" onPress={() => { setInteracted(true); setDistance((d) => clamp(d * 1.22, MIN_DISTANCE, MAX_DISTANCE)); }} label="Alejar" />
          <ControlButton icon="scan-outline" onPress={resetView} label="Reencuadrar" />
        </View>
      )}

      {!interacted && autoRotate && (
        <View style={[styles.hint, { backgroundColor: t.alpha(t.palette.neutral[950], 0.62), borderRadius: t.radius.pill }]} pointerEvents="none">
          <Ionicons name="hand-left-outline" size={13} color="#fff" />
          <Text variant="micro" color="#fff">Arrastra para girar · toca un espacio</Text>
        </View>
      )}
    </View>
  );
}

// ─── Construcción de la escena ────────────────────────────────────────────────

function buildScene({ plan, camera, colors, selectedSpotId, simplified, theme }: {
  plan: FloorPlan;
  camera: Camera;
  colors: SpotColors;
  selectedSpotId?: string | null;
  simplified: boolean;
  theme: ReturnType<typeof useTheme>;
}): Face<FaceMeta>[] {
  const faces: Face<FaceMeta>[] = [];
  const pad = 2.5;

  // Losa del piso.
  faces.push(
    ...box<FaceMeta>({
      center: v3(0, -0.9, 0),
      size: v3(plan.width + pad * 2, 0.9, plan.depth + pad * 2),
      color: colors.slabSide,
      topColor: colors.slabTop,
      camera,
    }),
  );

  // Carriles de circulación: asfalto más oscuro que la losa.
  for (const aisle of plan.aisles) {
    faces.push(
      plane<FaceMeta>({
        center: v3(0, 0.012, aisle.z),
        width: plan.width + pad,
        depth: aisle.width,
        color: colors.aisle,
        unlit: true,
      }),
    );
  }

  // Espacios.
  for (const spot of plan.spots) {
    const tone = colors.byStatus[spot.status];
    const isSelected = spot.id === selectedSpotId;
    const paint = isSelected ? colors.selected : tone;

    // Losa pintada del espacio.
    faces.push(
      plane<FaceMeta>({
        center: v3(spot.x, 0.03, spot.z),
        width: spot.width,
        depth: spot.depth,
        color: paint.floor,
        stroke: isSelected ? paint.edge : colors.lineMarking,
        strokeWidth: isSelected ? 2.4 : 1,
        meta: { spotId: spot.id },
        unlit: true,
      }),
    );

    if (simplified) continue;

    if (spot.status === SpotStatus.TAKEN) {
      // Un vehículo ocupando la plaza: cuerpo + cabina, orientado como el espacio.
      faces.push(...vehicle(spot, colors, camera));
    } else if (spot.status === SpotStatus.BLOCKED) {
      faces.push(...cone(spot.x, spot.z, colors.blockedCone, camera));
    } else if (isSelected) {
      // Pilar de luz sobre el espacio elegido: se ve desde cualquier ángulo.
      faces.push(
        ...box<FaceMeta>({
          center: v3(spot.x, 0.05, spot.z),
          size: v3(spot.width * 0.62, 3.4, spot.width * 0.62),
          color: theme.colors.brand,
          topColor: theme.palette.brand[300],
          opacity: 0.34,
          meta: { spotId: spot.id },
          camera,
        }),
      );
    }

    // Distintivo del tipo de plaza, pintado en el suelo.
    if (spot.kind !== SpotKind.STANDARD && spot.status !== SpotStatus.TAKEN) {
      faces.push(
        plane<FaceMeta>({
          center: v3(spot.x, 0.05, spot.z),
          width: spot.width * 0.42,
          depth: spot.width * 0.42,
          color: colors.byKind[spot.kind],
          opacity: 0.85,
          meta: { spotId: spot.id },
          unlit: true,
        }),
      );
    }
  }

  if (!simplified) {
    // Rampa de entrada de vehículos.
    faces.push(
      ...box<FaceMeta>({
        center: v3(plan.entrance.x, 0, plan.entrance.z + 2.4),
        size: v3(4.5, 0.35, 4),
        color: colors.entrance,
        camera,
      }),
    );
    // Núcleo de ascensores / salida peatonal.
    faces.push(
      ...box<FaceMeta>({
        center: v3(plan.pedestrianExit.x, 0, plan.pedestrianExit.z),
        size: v3(3.2, 4.6, 3.2),
        color: colors.core,
        topColor: theme.palette.accent[400],
        camera,
      }),
    );
  }

  return faces;
}

/** Vehículo estilizado: chasis + cabina, con la huella del espacio. */
function vehicle(spot: Spot, colors: SpotColors, camera: Camera): Face<FaceMeta>[] {
  const isMoto = spot.kind === SpotKind.MOTORCYCLE;
  const body = colors.cars[hashCode(spot.id) % colors.cars.length];
  const meta = { spotId: spot.id };

  if (isMoto) {
    return box<FaceMeta>({
      center: v3(spot.x, 0.05, spot.z),
      size: v3(spot.width * 0.5, 1.1, spot.depth * 0.72),
      color: body,
      meta, camera,
    });
  }

  return [
    ...box<FaceMeta>({
      center: v3(spot.x, 0.05, spot.z),
      size: v3(spot.width * 0.78, 0.78, spot.depth * 0.84),
      color: body,
      meta, camera,
    }),
    ...box<FaceMeta>({
      center: v3(spot.x, 0.83, spot.z - spot.depth * 0.04),
      size: v3(spot.width * 0.68, 0.52, spot.depth * 0.46),
      color: colors.cabin,
      meta, camera,
    }),
  ];
}

/** Cono de obra para los espacios fuera de servicio. */
function cone(x: number, z: number, color: string, camera: Camera): Face<FaceMeta>[] {
  return [
    ...box<FaceMeta>({ center: v3(x, 0.04, z), size: v3(0.8, 0.12, 0.8), color, camera }),
    ...box<FaceMeta>({ center: v3(x, 0.16, z), size: v3(0.42, 0.62, 0.42), color, camera }),
  ];
}

// ─── Etiquetas ────────────────────────────────────────────────────────────────

/**
 * Códigos de los espacios, proyectados al plano de la pantalla. Van como texto
 * SVG y no como geometría: así se leen rectos sea cual sea el ángulo.
 */
function SpotLabels({ plan, camera, selectedSpotId }: {
  plan: FloorPlan; camera: Camera; selectedSpotId?: string | null;
}) {
  const t = useTheme();
  const labels = plan.spots
    .map((spot) => {
      const p = camera.project(v3(spot.x, 0.08, spot.z));
      return { spot, p };
    })
    .filter(({ p }) => p.visible)
    // Más cerca = más grande; por debajo de cierto tamaño el texto es ruido.
    .map(({ spot, p }) => ({ spot, p, size: Math.max(0, 520 / p.depth) }))
    .filter(({ size, spot }) => size >= 7 || spot.id === selectedSpotId);

  return (
    <>
      {labels.map(({ spot, p, size }) => {
        const isSelected = spot.id === selectedSpotId;
        const free = spot.status === SpotStatus.FREE;
        return (
          <SvgText
            key={spot.id}
            x={p.x}
            y={p.y + size * 0.34}
            fontSize={Math.min(13, isSelected ? size * 1.25 : size)}
            fontWeight={isSelected ? '800' : '600'}
            textAnchor="middle"
            fill={
              isSelected ? t.palette.white
                : free ? t.mix(t.palette.mint[900], t.palette.white, t.scheme === 'dark' ? 0.75 : 0.1)
                : t.alpha(t.palette.white, 0.7)
            }
          >
            {spot.label}
          </SvgText>
        );
      })}
    </>
  );
}

// ─── Colores de la escena ─────────────────────────────────────────────────────

interface SpotTone { floor: string; edge: string }
interface SpotColors {
  slabTop: string; slabSide: string; aisle: string; lineMarking: string;
  entrance: string; core: string; blockedCone: string; cabin: string;
  selected: SpotTone;
  byStatus: Record<SpotStatus, SpotTone>;
  byKind: Record<SpotKind, string>;
  cars: string[];
}

function useSpotColors(): SpotColors {
  const t = useTheme();
  const dark = t.scheme === 'dark';

  return useMemo(() => ({
    slabTop:     dark ? '#2A2C35' : t.palette.neutral[200],
    slabSide:    dark ? '#1E2028' : t.palette.neutral[300],
    aisle:       dark ? '#23252D' : t.palette.neutral[300],
    lineMarking: dark ? t.alpha(t.palette.white, 0.35) : t.palette.white,
    entrance:    t.palette.accent[500],
    core:        dark ? '#2F3240' : t.palette.neutral[400],
    blockedCone: t.palette.amber[400],
    cabin:       dark ? '#3A3D48' : t.palette.neutral[600],
    selected:    { floor: t.palette.brand[500], edge: t.palette.brand[300] },
    byStatus: {
      [SpotStatus.FREE]:    { floor: dark ? t.palette.mint[800] : t.palette.mint[200], edge: t.palette.mint[500] },
      [SpotStatus.TAKEN]:   { floor: dark ? '#32343D' : t.palette.neutral[300],       edge: t.palette.neutral[400] },
      [SpotStatus.BLOCKED]: { floor: dark ? t.palette.amber[900] : t.palette.amber[100], edge: t.palette.amber[500] },
      [SpotStatus.MINE]:    { floor: t.palette.brand[400],                            edge: t.palette.brand[200] },
    },
    byKind: {
      [SpotKind.STANDARD]:   'transparent',
      [SpotKind.COMPACT]:    t.palette.neutral[400],
      [SpotKind.MOTORCYCLE]: t.palette.accent[400],
      [SpotKind.ACCESSIBLE]: t.palette.brand[500],
      [SpotKind.EV]:         t.palette.mint[500],
    },
    cars: [
      t.palette.neutral[500], t.palette.brand[400], t.palette.accent[500],
      t.palette.neutral[600], t.palette.rose[400], t.palette.amber[400],
    ],
  }), [t, dark]);
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Giro lento y continuo hasta que el usuario toma el control. */
function useAutoRotate(enabled: boolean, setYaw: React.Dispatch<React.SetStateAction<number>>) {
  React.useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setYaw((y) => y + 0.006), 33);
    return () => clearInterval(id);
  }, [enabled, setYaw]);
}

function ControlButton({ icon, onPress, label }: {
  icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.controlBtn,
        {
          backgroundColor: t.alpha(t.colors.surface, 0.92),
          borderColor: t.colors.border,
          borderRadius: t.radius.sm,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={t.colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls:   { position: 'absolute', right: 12, top: 12 },
  controlBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  hint:       { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
});
