import React from 'react';
import { Badge, BadgeTone } from '@/components/ui';
import { ReservationStatus } from '@/domain/enums';

const CONFIG: Record<ReservationStatus, { label: string; tone: BadgeTone }> = {
  [ReservationStatus.RESERVED]:   { label: 'Reservado',    tone: 'brand' },
  [ReservationStatus.CHECKED_IN]: { label: 'En uso',       tone: 'success' },
  [ReservationStatus.COMPLETED]:  { label: 'Completado',   tone: 'neutral' },
  [ReservationStatus.EXPIRED]:    { label: 'Expirado',     tone: 'neutral' },
  [ReservationStatus.CANCELLED]:  { label: 'Cancelado',    tone: 'neutral' },
  [ReservationStatus.OVERSTAY]:   { label: 'Tiempo extra', tone: 'danger' },
};

export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  const config = CONFIG[status] ?? { label: status, tone: 'neutral' as BadgeTone };
  return <Badge label={config.label} tone={config.tone} dot />;
}
