import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { emailConfigured, whatsappConfigured } from "@/server/services/notifications";
import { Badge, Card, CardTitle, PageHeader } from "@/components/ui/primitives";
import { HolidaysForm, ShopHoursForm, ShopSettingsForm } from "@/features/settings/SettingsForms";
import { todayIn } from "@/lib/time";

export const metadata = { title: "Configurações" };

export default async function Settings() {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const [hours, holidays] = await Promise.all([
    prisma.shopHours.findMany({ where: { shopId: shop.id } }),
    prisma.holiday.findMany({ where: { shopId: shop.id, date: { gte: todayIn(shop.timezone) } }, orderBy: { date: "asc" } }),
  ]);
  const integrations = [
    { name: "E-mail transacional (Resend)", ok: emailConfigured(), env: "RESEND_API_KEY, EMAIL_FROM" },
    { name: "WhatsApp Business Cloud API", ok: whatsappConfigured(), env: "WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID" },
    { name: "Pagamentos online (Mercado Pago / Pix / cartão)", ok: false, env: "não implementado — arquitetura preparada" },
  ];
  return (
    <>
      <PageHeader title="Configurações" description="Dados da barbearia, funcionamento, regras de reserva e integrações." />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <ShopSettingsForm shop={shop} />
        <div className="space-y-6">
          <ShopHoursForm hours={hours} />
          <HolidaysForm holidays={holidays} />
          <Card>
            <CardTitle>Integrações</CardTitle>
            <ul className="space-y-3 text-sm">
              {integrations.map((i) => (
                <li key={i.name} className="flex items-start justify-between gap-3">
                  <span><span className="text-cream">{i.name}</span><span className="block text-xs text-smoke">{i.env}</span></span>
                  <Badge tone={i.ok ? "success" : "neutral"}>{i.ok ? "Configurado" : "Não configurado"}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-smoke">Lembretes automáticos são gerados pelo endpoint /api/cron/notifications (agendar a cada 10 min). Sem provedor, as notificações ficam visíveis apenas no site.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
