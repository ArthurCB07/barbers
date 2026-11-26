import { requireShop } from "@/server/shop";
import { getSession } from "@/server/auth/session";
import { getInvite } from "@/server/services/accounts";
import { AuthShell } from "@/components/layout/AuthShell";
import { InviteForm } from "@/features/auth/forms";
import { Avatar } from "@/components/ui/primitives";
import { safeJson } from "@/lib/utils";

export const metadata = { title: "Convite para a equipe" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shop = await requireShop();
  const [invite, session] = await Promise.all([getInvite(token), getSession()]);
  if (!invite) {
    return (
      <AuthShell shopName={shop.name} title="Convite indisponível" subtitle="Este link expirou, foi revogado ou já foi utilizado. Peça um novo convite ao proprietário.">
        <p className="text-sm text-smoke">Convites são válidos por 7 dias e podem ser usados uma única vez.</p>
      </AuthShell>
    );
  }
  const meta = safeJson<{ inviteName?: string }>(invite.barber.adminNote, {});
  return (
    <AuthShell shopName={shop.name} eyebrow="Convite profissional" title={`Bem-vindo à equipe ${shop.name}`} subtitle="Seu perfil, serviços, agenda e estação já foram preparados pelo proprietário. Defina sua senha para começar." wide>
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-gold/20 bg-gold/5 p-4">
        <Avatar name={invite.barber.displayName} src={invite.barber.photoUrl} size={56} />
        <div>
          <p className="font-display text-xl">{invite.barber.displayName}</p>
          <p className="text-xs text-smoke">Convite para {invite.email}</p>
        </div>
      </div>
      <InviteForm token={token} email={invite.email} defaultName={meta.inviteName ?? ""} loggedInAs={session?.user.email ?? null} />
    </AuthShell>
  );
}
