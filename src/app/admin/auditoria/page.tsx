import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Auditoria" };

export default async function Audit() {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const logs = await prisma.auditLog.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 200 });
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.actorUserId).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
  const name = new Map(users.map((u) => [u.id, u.name]));
  return (
    <>
      <PageHeader title="Auditoria" description="Registro das ações administrativas relevantes (últimas 200)." />
      <Table>
        <thead><tr><Th>Quando</Th><Th>Quem</Th><Th>Ação</Th><Th>Entidade</Th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <Td className="text-xs">{formatDateTime(l.createdAt, shop.timezone)}</Td>
              <Td>{l.actorUserId ? name.get(l.actorUserId) ?? "—" : "Sistema"}</Td>
              <Td className="font-mono text-xs text-gold-soft">{l.action}</Td>
              <Td className="text-xs">{l.entity}{l.entityId && <span className="text-smoke"> · {l.entityId.slice(-8)}</span>}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
