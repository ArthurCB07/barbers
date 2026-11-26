import Link from "next/link";
import { Heart } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { Avatar, Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui/primitives";
import { ActionButton } from "@/components/ui/client";
import { toggleFavoriteAction } from "@/server/actions/app";
import { safeJson } from "@/lib/utils";

export const metadata = { title: "Meus barbeiros" };

export default async function MyBarbers() {
  const shop = await requireShop();
  const s = await requireRole("CLIENT");
  const [favorites, barbers] = await Promise.all([
    prisma.favorite.findMany({ where: { userId: s.user.id }, select: { barberProfileId: true } }),
    prisma.barberProfile.findMany({ where: { shopId: shop.id, status: "APPROVED", userId: { not: null } }, include: { station: true } }),
  ]);
  const favSet = new Set(favorites.map((f) => f.barberProfileId));
  const sorted = [...barbers].sort((a, b) => Number(favSet.has(b.id)) - Number(favSet.has(a.id)));
  return (
    <>
      <PageHeader title="Meus barbeiros" description="Marque seus profissionais favoritos para encontrá-los rapidamente." />
      {sorted.length === 0 ? (
        <EmptyState icon={<Heart className="h-8 w-8" />} title="Nenhum profissional disponível" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((b) => {
            const fav = favSet.has(b.id);
            const own = b.id === s.actor.barberProfileId;
            return (
              <Card key={b.id} className={fav ? "border-gold/40" : ""}>
                <div className="flex items-center gap-4">
                  <Avatar name={b.displayName} src={b.photoUrl} size={60} />
                  <div className="min-w-0">
                    <p className="font-display text-xl text-cream">{b.displayName}</p>
                    {b.station && <p className="text-xs text-smoke">{b.station.name}</p>}
                    {fav && <Badge tone="gold" className="mt-1">Favorito</Badge>}
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-mist">{b.bio}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {safeJson<string[]>(b.specialties, []).map((sp) => (
                    <Badge key={sp}>{sp}</Badge>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  {!own && <LinkButton size="sm" href={b.station ? `/barbearia?estacao=${b.station.id}` : "/cliente/agendar"}>Agendar</LinkButton>}
                  {!own && (
                    <ActionButton action={toggleFavoriteAction.bind(null, b.id)} variant={fav ? "outline" : "secondary"}>
                      <Heart className={`h-3.5 w-3.5 ${fav ? "fill-gold text-gold" : ""}`} /> {fav ? "Remover" : "Favoritar"}
                    </ActionButton>
                  )}
                  {own && <Link href="/barbeiro/meu-espaco" className="text-xs text-gold-soft">Este é você</Link>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
