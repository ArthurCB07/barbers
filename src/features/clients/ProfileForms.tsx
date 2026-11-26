"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { Button, Card, CardTitle, Checkbox, Field, Input, Textarea } from "@/components/ui/primitives";
import { Dialog, SubmitButton, useAction } from "@/components/ui/client";
import { changePasswordAction, deleteAccountAction, updateProfileAction } from "@/server/actions/app";

export function ProfileForm({ initial }: { initial: { name: string; email: string; phone: string; notifyEmail: boolean; notifyWhatsapp: boolean; preferences: string; sharePreferences: boolean } }) {
  const [f, setF] = useState(initial);
  const { run, pending, fieldErrors: fe } = useAction(updateProfileAction);
  return (
    <Card>
      <CardTitle>Dados pessoais e preferências</CardTitle>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(f); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="name" error={fe.name}>
            <Input id="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <Field label="Telefone" htmlFor="phone" error={fe.phone}>
            <Input id="phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="E-mail" htmlFor="email" error={fe.email}>
          <Input id="email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Preferências de atendimento" htmlFor="prefs" hint="ex.: degradê baixo, sem navalha" error={fe.preferences}>
          <Textarea id="prefs" value={f.preferences} maxLength={500} onChange={(e) => setF({ ...f, preferences: e.target.value })} />
        </Field>
        <Checkbox checked={f.sharePreferences} onChange={(e) => setF({ ...f, sharePreferences: e.target.checked })} label="Compartilhar minhas preferências com o profissional que me atender" />
        <fieldset className="space-y-2 rounded-xl border border-line p-4">
          <legend className="px-1 text-xs uppercase tracking-[0.14em] text-mist">Comunicações</legend>
          <Checkbox checked={f.notifyEmail} onChange={(e) => setF({ ...f, notifyEmail: e.target.checked })} label="Confirmações e lembretes por e-mail" />
          <Checkbox checked={f.notifyWhatsapp} onChange={(e) => setF({ ...f, notifyWhatsapp: e.target.checked })} label="Lembretes pelo WhatsApp" description="Requer integração oficial configurada pela barbearia." />
        </fieldset>
        <SubmitButton pending={pending}>Salvar alterações</SubmitButton>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const { run, pending } = useAction(changePasswordAction, { refresh: false, onSuccess: () => setF({ current: "", next: "", confirm: "" }) });
  return (
    <Card>
      <CardTitle>Senha</CardTitle>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(f.current, f.next, f.confirm); }}>
        <Field label="Senha atual" htmlFor="cur">
          <Input id="cur" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        </Field>
        <Field label="Nova senha" htmlFor="new" hint="mín. 8, letras e números">
          <Input id="new" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        </Field>
        <Field label="Confirmar nova senha" htmlFor="conf">
          <Input id="conf" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        </Field>
        <SubmitButton pending={pending} variant="secondary">Alterar senha</SubmitButton>
      </form>
    </Card>
  );
}

export function PrivacyCard({ canDelete }: { canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const router = useRouter();
  const del = useAction(deleteAccountAction, { refresh: false, onSuccess: () => router.push("/") });
  return (
    <Card>
      <CardTitle>Privacidade (LGPD)</CardTitle>
      <p className="text-sm text-mist">Baixe uma cópia dos seus dados ou exclua sua conta. Registros de atendimentos e pagamentos são mantidos de forma anonimizada por obrigação legal.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/api/me/export" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-slate px-4 text-sm text-cream hover:bg-line">
          <Download className="h-4 w-4" /> Exportar meus dados
        </a>
        {canDelete && (
          <Button variant="danger" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4" /> Excluir conta
          </Button>
        )}
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Excluir conta">
        <p className="text-sm text-mist">Esta ação não pode ser desfeita. Seus dados pessoais serão anonimizados e você perderá o acesso. Agendamentos futuros precisam ser cancelados antes.</p>
        <Field label="Confirme sua senha" htmlFor="delpwd" className="mt-4">
          <Input id="delpwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Voltar</Button>
          <Button variant="danger" disabled={del.pending || !pwd} onClick={() => del.run(pwd)}>Excluir definitivamente</Button>
        </div>
      </Dialog>
    </Card>
  );
}
