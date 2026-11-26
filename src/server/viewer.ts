import { prisma } from "./db";
import { getSession, type SessionContext } from "./auth/session";
import type { ViewerInfo } from "@/features/barbershop-3d/BarberPanel";

export async function getViewer(nextPath: string): Promise<{ viewer: ViewerInfo; session: SessionContext | null }> {
  const session = await getSession();
  const favorites = session ? await prisma.favorite.findMany({ where: { userId: session.user.id }, select: { barberProfileId: true } }) : [];
  return {
    session,
    viewer: {
      isLoggedIn: !!session,
      // Quem possui o papel CLIENT pode agendar (o servidor revalida); "Trocar perfil" muda a interface
      isClient: !!session && session.actor.roles.includes("CLIENT"),
      ownBarberProfileId: session?.actor.barberProfileId ?? null,
      favoriteIds: favorites.map((f) => f.barberProfileId),
      loginHref: `/entrar?next=${encodeURIComponent(nextPath)}&perfil=CLIENT`,
    },
  };
}
