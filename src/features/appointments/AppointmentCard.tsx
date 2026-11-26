import { CalendarDays, Clock, MapPin } from "lucide-react";
import { Avatar, Badge, Card, STATUS_TONE } from "@/components/ui/primitives";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/types/domain";
import { formatDuration, formatMoney } from "@/lib/utils";
import { formatDateTime, formatTime } from "@/lib/time";

export function AppointmentCard({
  a,
  tz,
  actions,
  showClient,
}: {
  a: { id: string; status: string; startsAt: Date; endsAt: Date; priceCents: number; durationMin: number; clientNote?: string; barber: { displayName: string; photoUrl: string | null }; service: { name: string }; station?: { name: string } | null; client?: { name: string } };
  tz: string;
  actions?: React.ReactNode;
  showClient?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Avatar name={showClient && a.client ? a.client.name : a.barber.displayName} src={showClient ? null : a.barber.photoUrl} size={48} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-cream">{a.service.name}</p>
            <Badge tone={STATUS_TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-mist">{showClient && a.client ? `${a.client.name} · com ${a.barber.displayName}` : `com ${a.barber.displayName}`}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-smoke">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-gold" /> {formatDateTime(a.startsAt, tz)} – {formatTime(a.endsAt, tz)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {formatDuration(a.durationMin)}
            </span>
            {a.station && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {a.station.name}
              </span>
            )}
            <span className="font-medium text-gold-soft">{formatMoney(a.priceCents)}</span>
          </p>
          {a.clientNote && <p className="mt-1 text-xs italic text-smoke">“{a.clientNote}”</p>}
        </div>
      </div>
      {actions && <div className="sm:shrink-0">{actions}</div>}
    </Card>
  );
}
