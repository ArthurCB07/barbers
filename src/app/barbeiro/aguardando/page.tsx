import Link from "next/link";
import { redirect } from "next/navigation";
import { Hourglass, CheckCircle2, XCircle, FileQuestion } from "lucide-react";
import { requireSession } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { AuthShell } from "@/components/layout/AuthShell";
import { Notice, buttonClass } from "@/components/ui/primitives";
import { PartnerRequestForm, PendingPhotoForm } from "@/features/auth/forms";
import { safeJson } from "@/lib/utils";
import { formatDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitação de parceria" };

export default async function WaitingApproval() {
  const shop = await requireShop();
  const s = await requireSession("/barbeiro/aguardando");
  if (s.actor.barberProfileId) redirect("/barbeiro");
  const profile = await prisma.barberProfile.findFirst({ where: { userId: s.user.id, shopId: shop.id }, include: { partnerRequests: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!profile) redirect("/cadastro/barbeiro");
  const req = profile.partnerRequests[0];
  const initial = { displayName: profile.displayName, bio: profile.bio, specialties: safeJson<string[]>(profile.specialties, []), experience: profile.experience, photoUrl: profile.photoUrl, message: "" };

  return (
    <AuthShell shopName={shop.name} eyebrow="Solicitação de parceria" title={profile.status === "NEEDS_INFO" ? "Complemente seus dados" : profile.status === "REJECTED" ? "Solicitação não aprovada" : profile.status === "INACTIVE" ? "Perfil desligado" : "Seu cadastro está aguardando aprovação do proprietário."} wide>
      {profile.status === "PENDING" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <p className="text-sm text-mist">Enviada em {req ? formatDateTime(req.createdAt, shop.timezone) : "—"}. Você receberá uma notificação assim que o proprietário analisar. Até lá, você não tem acesso à agenda da equipe, mas pode usar a barbearia como cliente.</p>
          </div>
          <ol className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" /> Conta criada</li>
            <li className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" /> Perfil profissional enviado</li>
            <li className="flex items-center gap-2 text-warning"><Hourglass className="h-4 w-4" /> Análise do proprietário</li>
            <li className="flex items-center gap-2 text-smoke"><span className="h-4 w-4 rounded-full border border-line" /> Definição de comissão e estação 3D</li>
          </ol>
          <div className="rounded-xl border border-line p-4">
            <PendingPhotoForm initial={profile.photoUrl} name={profile.displayName} />
          </div>
        </div>
      )}
      {profile.status === "NEEDS_INFO" && (
        <div className="space-y-4">
          <Notice tone="info" title="Mensagem do proprietário">
            <span className="inline-flex items-start gap-2"><FileQuestion className="mt-0.5 h-4 w-4 shrink-0" /> {profile.adminNote}</span>
          </Notice>
          <PartnerRequestForm initial={initial} mode="resubmit" />
        </div>
      )}
      {profile.status === "REJECTED" && (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-mist"><XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" /> {profile.adminNote || "Sua solicitação não foi aprovada neste momento."}</p>
          <p className="text-sm text-smoke">Você pode atualizar seu perfil e enviar uma nova solicitação.</p>
          <PartnerRequestForm initial={initial} mode="new" />
        </div>
      )}
      {profile.status === "INACTIVE" && <p className="text-sm text-mist">Seu perfil profissional foi desligado pelo proprietário. Seu histórico foi preservado.</p>}
      <div className="mt-6 flex flex-wrap gap-2 border-t hairline pt-5">
        <Link href="/barbearia" className={buttonClass("outline", "sm")}>Explorar a barbearia</Link>
        <Link href="/cliente" className={buttonClass("ghost", "sm")}>Usar como cliente</Link>
      </div>
    </AuthShell>
  );
}
