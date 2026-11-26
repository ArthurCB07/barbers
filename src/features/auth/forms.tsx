"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Input, Field, Checkbox, Textarea, Notice } from "@/components/ui/primitives";
import { SubmitButton, useAction, ImageUpload, TagInput } from "@/components/ui/client";
import {
  loginAction, registerClientAction, registerBarberAction, forgotPasswordAction, resetPasswordAction,
  acceptInviteAction, setupAction, requestPartnershipAction, resubmitPartnerAction, updatePendingPhotoAction,
} from "@/server/actions/auth";

function PasswordInput({ id, value, onChange, autoComplete, invalid }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={invalid} className="pr-11" required />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-smoke hover:text-cream" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Após autenticar, recarrega a página inteira para que toda a árvore leia a nova sessão */
function useRedirectOnSuccess() {
  return (data?: { redirectTo: string }) => {
    if (data?.redirectTo) window.location.assign(data.redirectTo);
  };
}

// ─── Login ───────────────────────────────────────────────────────────────────

export function LoginForm({ next, preferredRole }: { next?: string; preferredRole?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const go = useRedirectOnSuccess();
  const { run, pending, fieldErrors } = useAction(loginAction, { refresh: false, onSuccess: go });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ email, password, next, preferredRole });
      }}
    >
      <Field label="E-mail" htmlFor="email" error={fieldErrors.email}>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Senha" htmlFor="password" error={fieldErrors.password}>
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <div className="flex justify-end">
        <Link href="/recuperar-senha" className="text-xs text-gold-soft hover:text-gold">
          Esqueci minha senha
        </Link>
      </div>
      <SubmitButton pending={pending} className="w-full" size="lg">
        Entrar
      </SubmitButton>
    </form>
  );
}

// ─── Cadastro de cliente ─────────────────────────────────────────────────────

export function ClientRegisterForm({ next }: { next?: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "", acceptTerms: false, notifyWhatsapp: false });
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const go = useRedirectOnSuccess();
  const { run, pending, fieldErrors: fe } = useAction(registerClientAction, { refresh: false, onSuccess: go });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ ...f, next });
      }}
    >
      <Field label="Nome" htmlFor="name" error={fe.name}>
        <Input id="name" autoComplete="name" value={f.name} onChange={(e) => set("name")(e.target.value)} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-mail" htmlFor="email" error={fe.email}>
          <Input id="email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email")(e.target.value)} required />
        </Field>
        <Field label="Telefone" htmlFor="phone" error={fe.phone}>
          <Input id="phone" type="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={f.phone} onChange={(e) => set("phone")(e.target.value)} required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Senha" htmlFor="password" error={fe.password} hint="mín. 8, letras e números">
          <PasswordInput id="password" value={f.password} onChange={set("password")} autoComplete="new-password" invalid={!!fe.password} />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm" error={fe.confirmPassword}>
          <PasswordInput id="confirm" value={f.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" invalid={!!fe.confirmPassword} />
        </Field>
      </div>
      <Checkbox checked={f.notifyWhatsapp} onChange={(e) => set("notifyWhatsapp")(e.target.checked)} label="Quero receber lembretes pelo WhatsApp" description="Você pode alterar isso a qualquer momento no seu perfil." />
      <div>
        <Checkbox
          checked={f.acceptTerms}
          onChange={(e) => set("acceptTerms")(e.target.checked)}
          label={
            <>
              Li e aceito os{" "}
              <Link href="/privacidade" target="_blank" className="text-gold-soft underline">
                termos e a política de privacidade
              </Link>
            </>
          }
        />
        {fe.acceptTerms && <p className="mt-1 text-xs text-danger">{fe.acceptTerms[0]}</p>}
      </div>
      <SubmitButton pending={pending} className="w-full" size="lg">
        Criar conta e entrar na barbearia
      </SubmitButton>
    </form>
  );
}

// ─── Cadastro de barbeiro ────────────────────────────────────────────────────

function ProfessionalFields({ f, set, fe, askPhoto = true }: { f: Record<string, unknown>; set: (k: string) => (v: unknown) => void; fe: Record<string, string[] | undefined>; askPhoto?: boolean }) {
  return (
    <>
      <Field label="Nome profissional" htmlFor="displayName" error={fe.displayName} hint="como aparecerá para os clientes">
        <Input id="displayName" value={String(f.displayName ?? "")} onChange={(e) => set("displayName")(e.target.value)} required />
      </Field>
      {askPhoto && <ImageUpload value={(f.photoUrl as string) ?? null} onChange={set("photoUrl")} name={String(f.displayName || "Foto")} />}
      <Field label="Biografia" htmlFor="bio" error={fe.bio}>
        <Textarea id="bio" value={String(f.bio ?? "")} onChange={(e) => set("bio")(e.target.value)} placeholder="Conte um pouco sobre seu estilo e trajetória (mín. 20 caracteres)" maxLength={800} required />
      </Field>
      <Field label="Especialidades" htmlFor="specialties" error={fe.specialties}>
        <TagInput id="specialties" value={(f.specialties as string[]) ?? []} onChange={set("specialties")} placeholder="Ex.: Degradê, Barba, Tesoura…" />
      </Field>
      <Field label="Experiência profissional" htmlFor="experience" hint="opcional" error={fe.experience}>
        <Textarea id="experience" value={String(f.experience ?? "")} onChange={(e) => set("experience")(e.target.value)} className="min-h-20" maxLength={800} />
      </Field>
      <Field label="Mensagem ao proprietário" htmlFor="message" hint="opcional" error={fe.message}>
        <Input id="message" value={String(f.message ?? "")} onChange={(e) => set("message")(e.target.value)} placeholder="Disponibilidade, expectativas…" maxLength={500} />
      </Field>
    </>
  );
}

export function BarberRegisterForm() {
  const [f, setF] = useState<Record<string, unknown>>({ name: "", email: "", phone: "", password: "", confirmPassword: "", displayName: "", photoUrl: null, bio: "", specialties: [], experience: "", message: "", acceptTerms: false });
  const set = (k: string) => (v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const go = useRedirectOnSuccess();
  const { run, pending, fieldErrors: fe } = useAction(registerBarberAction, { refresh: false, onSuccess: go });
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void run(f);
      }}
    >
      <fieldset className="space-y-4">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Dados de acesso</legend>
        <Field label="Nome completo" htmlFor="name" error={fe.name as string[]}>
          <Input id="name" autoComplete="name" value={String(f.name)} onChange={(e) => set("name")(e.target.value)} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" htmlFor="email" error={fe.email}>
            <Input id="email" type="email" autoComplete="email" value={String(f.email)} onChange={(e) => set("email")(e.target.value)} required />
          </Field>
          <Field label="Telefone" htmlFor="phone" error={fe.phone}>
            <Input id="phone" type="tel" autoComplete="tel" value={String(f.phone)} onChange={(e) => set("phone")(e.target.value)} required />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Senha" htmlFor="password" error={fe.password} hint="mín. 8, letras e números">
            <PasswordInput id="password" value={String(f.password)} onChange={set("password")} autoComplete="new-password" />
          </Field>
          <Field label="Confirmar senha" htmlFor="confirm" error={fe.confirmPassword}>
            <PasswordInput id="confirm" value={String(f.confirmPassword)} onChange={set("confirmPassword")} autoComplete="new-password" />
          </Field>
        </div>
      </fieldset>
      <fieldset className="space-y-4 border-t hairline pt-5">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-gold">Perfil profissional</legend>
        <Notice tone="info">Depois de enviar, você poderá adicionar sua foto profissional na tela de acompanhamento da solicitação.</Notice>
        <ProfessionalFields f={f} set={set} fe={fe} askPhoto={false} />
      </fieldset>
      <div>
        <Checkbox checked={!!f.acceptTerms} onChange={(e) => set("acceptTerms")(e.target.checked)} label={<>Li e aceito os <Link href="/privacidade" target="_blank" className="text-gold-soft underline">termos e a política de privacidade</Link></>} />
        {fe.acceptTerms && <p className="mt-1 text-xs text-danger">{fe.acceptTerms[0]}</p>}
      </div>
      <SubmitButton pending={pending} className="w-full" size="lg">
        Enviar solicitação de parceria
      </SubmitButton>
      <p className="text-center text-xs text-smoke">Seu acesso à agenda da equipe é liberado somente após a aprovação do proprietário.</p>
    </form>
  );
}

/** Solicitação feita por quem já tem conta (ex.: cliente) */
export function PartnerRequestForm({ initial, mode = "new" }: { initial?: Record<string, unknown>; mode?: "new" | "resubmit" }) {
  const [f, setF] = useState<Record<string, unknown>>({ displayName: "", photoUrl: null, bio: "", specialties: [], experience: "", message: "", ...initial });
  const set = (k: string) => (v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const { run, pending, fieldErrors: fe } = useAction(mode === "new" ? requestPartnershipAction : resubmitPartnerAction);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(f);
      }}
    >
      <ProfessionalFields f={f} set={set} fe={fe} />
      <SubmitButton pending={pending} className="w-full">
        {mode === "new" ? "Solicitar participação na equipe" : "Reenviar para análise"}
      </SubmitButton>
    </form>
  );
}

export function PendingPhotoForm({ initial, name }: { initial: string | null; name: string }) {
  const [url, setUrl] = useState(initial);
  const { run } = useAction(updatePendingPhotoAction);
  return (
    <ImageUpload
      value={url}
      name={name}
      label="Foto profissional"
      onChange={(v) => {
        setUrl(v);
        void run(v);
      }}
    />
  );
}

// ─── Recuperação de senha ────────────────────────────────────────────────────

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [devLink, setDevLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { run, pending } = useAction(forgotPasswordAction, { refresh: false, onSuccess: (d) => { setSent(true); setDevLink(d?.devLink ?? null); } });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(email); }}>
      <Field label="E-mail da conta" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <SubmitButton pending={pending} className="w-full">
        Enviar instruções
      </SubmitButton>
      {sent && <Notice tone="success">Se o e-mail estiver cadastrado, você receberá um link válido por 1 hora.</Notice>}
      {devLink && (
        <Notice tone="warning" title="Ambiente de desenvolvimento">
          Nenhum provedor de e-mail está configurado. Link de teste: <Link className="underline" href={devLink}>redefinir senha</Link>
        </Notice>
      )}
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const router = useRouter();
  const { run, pending } = useAction((a: string, b: string) => resetPasswordAction(token, a, b), { refresh: false, onSuccess: () => router.push("/entrar") });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(p, c); }}>
      <Field label="Nova senha" htmlFor="p" hint="mín. 8, letras e números">
        <PasswordInput id="p" value={p} onChange={setP} autoComplete="new-password" />
      </Field>
      <Field label="Confirmar nova senha" htmlFor="c">
        <PasswordInput id="c" value={c} onChange={setC} autoComplete="new-password" />
      </Field>
      <SubmitButton pending={pending} className="w-full">
        Redefinir senha
      </SubmitButton>
    </form>
  );
}

// ─── Convite ─────────────────────────────────────────────────────────────────

export function InviteForm({ token, email, defaultName, loggedInAs }: { token: string; email: string; defaultName: string; loggedInAs: string | null }) {
  const [f, setF] = useState({ name: defaultName, phone: "", password: "", confirmPassword: "", acceptTerms: false });
  const go = useRedirectOnSuccess();
  const { run, pending, fieldErrors: fe } = useAction((input: unknown) => acceptInviteAction(token, input), { refresh: false, onSuccess: go });
  if (loggedInAs === email) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-mist">Você está conectado como <strong className="text-cream">{email}</strong>. Aceite para ativar seu perfil profissional nesta conta.</p>
        <form onSubmit={(e) => { e.preventDefault(); void run({}); }}>
          <SubmitButton pending={pending} className="w-full" size="lg">
            Aceitar convite
          </SubmitButton>
        </form>
      </div>
    );
  }
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(f); }}>
      {loggedInAs && <Notice tone="warning">Você está conectado com outro e-mail ({loggedInAs}). Ao continuar, uma nova conta será criada para {email}.</Notice>}
      <Field label="E-mail" htmlFor="email">
        <Input id="email" value={email} disabled />
      </Field>
      <Field label="Nome completo" htmlFor="name" error={fe.name}>
        <Input id="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </Field>
      <Field label="Telefone" htmlFor="phone" error={fe.phone}>
        <Input id="phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Senha" htmlFor="password" error={fe.password}>
          <PasswordInput id="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm" error={fe.confirmPassword}>
          <PasswordInput id="confirm" value={f.confirmPassword} onChange={(v) => setF({ ...f, confirmPassword: v })} autoComplete="new-password" />
        </Field>
      </div>
      <Checkbox checked={f.acceptTerms} onChange={(e) => setF({ ...f, acceptTerms: e.target.checked })} label={<>Aceito os <Link href="/privacidade" target="_blank" className="text-gold-soft underline">termos e a política de privacidade</Link></>} />
      <SubmitButton pending={pending} className="w-full" size="lg">
        Concluir cadastro e entrar
      </SubmitButton>
    </form>
  );
}

// ─── Configuração inicial ────────────────────────────────────────────────────

export function SetupForm() {
  const [f, setF] = useState({ token: "", shopName: "", ownerName: "", ownerEmail: "", ownerPhone: "", ownerPassword: "", ownerDisplayName: "", ownerIsBarber: true });
  const set = (k: keyof typeof f) => (v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const go = useRedirectOnSuccess();
  const { run, pending, fieldErrors: fe } = useAction(setupAction, { refresh: false, onSuccess: go });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run(f); }}>
      <Field label="Token de configuração (SETUP_TOKEN)" htmlFor="token">
        <Input id="token" type="password" value={f.token} onChange={(e) => set("token")(e.target.value)} required autoComplete="off" />
      </Field>
      <Field label="Nome da barbearia" htmlFor="shopName" error={fe.shopName}>
        <Input id="shopName" value={f.shopName} onChange={(e) => set("shopName")(e.target.value)} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Seu nome" htmlFor="ownerName" error={fe.ownerName}>
          <Input id="ownerName" value={f.ownerName} onChange={(e) => set("ownerName")(e.target.value)} required />
        </Field>
        <Field label="Nome profissional" htmlFor="ownerDisplayName" error={fe.ownerDisplayName}>
          <Input id="ownerDisplayName" value={f.ownerDisplayName} onChange={(e) => set("ownerDisplayName")(e.target.value)} required />
        </Field>
        <Field label="E-mail" htmlFor="ownerEmail" error={fe.ownerEmail}>
          <Input id="ownerEmail" type="email" value={f.ownerEmail} onChange={(e) => set("ownerEmail")(e.target.value)} required />
        </Field>
        <Field label="Telefone" htmlFor="ownerPhone" error={fe.ownerPhone}>
          <Input id="ownerPhone" type="tel" value={f.ownerPhone} onChange={(e) => set("ownerPhone")(e.target.value)} required />
        </Field>
      </div>
      <Field label="Senha" htmlFor="ownerPassword" error={fe.ownerPassword} hint="mín. 8, letras e números">
        <PasswordInput id="ownerPassword" value={f.ownerPassword} onChange={set("ownerPassword")} autoComplete="new-password" />
      </Field>
      <Checkbox checked={f.ownerIsBarber} onChange={(e) => set("ownerIsBarber")(e.target.checked)} label="Também atendo como o barbeiro inicial" description="Cria sua agenda e vincula você à Estação 01 da barbearia 3D." />
      <SubmitButton pending={pending} className="w-full" size="lg">
        Criar barbearia
      </SubmitButton>
    </form>
  );
}
