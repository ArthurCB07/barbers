import Link from "next/link";
import { Download } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { requireShop } from "@/server/shop";
import { prisma } from "@/server/db";
import { Input, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/time";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Clientes" };

export default async function AdminClients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const shop = await requireShop();
  await requireRole("ADMIN");
  const { q = "" } = await searchParams;
  const roles = await prisma.roleAssignment.findMany({
    where: {
      shopId: shop.id,
      role: "CLIENT",
      user: { anonymizedAt: null, ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}) },
    },
    include: { user: { include: { appointments: { where: { shopId: shop.id }, select: { status: true, startsAt: true, priceCents: true }, orderBy: { startsAt: "desc" } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader
        title="Clientes"
        description="Pesquise clientes, veja frequência e histórico. Dados tratados conforme a LGPD — acesse apenas o necessário."
        actions={<a href="/api/admin/export?type=clients" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-slate px-4 text-sm"><Download className="h-4 w-4" /> Exportar CSV</a>}
      />
      <form className="mb-4 max-w-md"><Input name="q" defaultValue={q} placeholder="Buscar por nome, e-mail ou telefone" aria-label="Buscar clientes" /></form>
      <Table>
        <thead><tr><Th>Cliente</Th><Th>Contato</Th><Th>Cadastro</Th><Th>Atendimentos</Th><Th>Último</Th><Th>Total</Th></tr></thead>
        <tbody>
          {roles.length === 0 && <tr><Td colSpan={6} className="text-center text-smoke">Nenhum cliente encontrado.</Td></tr>}
          {roles.map((r) => {
            const done = r.user.appointments.filter((a) => a.status === "COMPLETED");
            const last = r.user.appointments.find((a) => a.status !== "CANCELLED");
            return (
              <tr key={r.id} className="hover:bg-white/[0.02]">
                <Td><Link href={`/admin/clientes/${r.user.id}`} className="font-medium text-cream hover:text-gold-soft">{r.user.name}</Link></Td>
                <Td className="text-xs">{r.user.email}<br />{r.user.phone}</Td>
                <Td>{formatDate(r.createdAt, shop.timezone)}</Td>
                <Td>{done.length}</Td>
                <Td className="text-xs">{last ? formatDateTime(last.startsAt, shop.timezone) : "—"}</Td>
                <Td>{formatMoney(done.reduce((s, a) => s + a.priceCents, 0))}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
