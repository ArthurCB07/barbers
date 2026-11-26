import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/server/db";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ActionButton } from "@/components/ui/client";
import { markNotificationsReadAction } from "@/server/actions/app";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export async function NotificationsList({ userId, tz }: { userId: string; tz: string }) {
  const items = await prisma.notification.findMany({
    where: { userId, type: { not: "PASSWORD_RESET" } },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { deliveries: { select: { channel: true, status: true } } },
  });
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <>
      <PageHeader
        title="Notificações"
        description="Confirmações, alterações e lembretes. Entregas por e-mail/WhatsApp dependem das suas preferências e da integração configurada pela barbearia."
        actions={unread > 0 ? <ActionButton action={markNotificationsReadAction.bind(null, undefined)} successMessage="Tudo marcado como lido.">Marcar todas como lidas</ActionButton> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="h-8 w-8" />} title="Nenhuma notificação por enquanto" />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card className={cn("flex items-start gap-4 p-4", !n.readAt && "border-gold/30 bg-gold/[0.04]")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-line" : "bg-gold")} aria-label={n.readAt ? "Lida" : "Não lida"} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-cream">{n.title}</p>
                  <p className="mt-0.5 text-sm text-mist">{n.body}</p>
                  <p className="mt-1.5 text-xs text-smoke">
                    {formatDateTime(n.createdAt, tz)}
                    {n.deliveries
                      .filter((d) => d.channel !== "INAPP")
                      .map((d) => ` · ${d.channel === "EMAIL" ? "E-mail" : "WhatsApp"}: ${d.status === "SENT" ? "enviado" : d.status === "QUEUED" ? "envio pendente" : d.status === "SKIPPED" ? "não configurado" : "falhou"}`)
                      .join("")}
                  </p>
                </div>
                {n.link && (
                  <Link href={n.link} className="shrink-0 text-xs text-gold-soft hover:text-gold">
                    Abrir
                  </Link>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
