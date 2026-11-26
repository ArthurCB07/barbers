"use client";

/**
 * Utilitários de interface do lado do cliente: toasts, execução de Server
 * Actions com estado de carregamento, diálogo acessível e upload de imagem.
 */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, X, Upload, Loader2 } from "lucide-react";
import type { ActionResult } from "@/types/domain";
import { cn } from "@/lib/utils";
import { Button, Avatar } from "./primitives";

// ─── Toasts ──────────────────────────────────────────────────────────────────

type ToastItem = { id: number; tone: "success" | "error"; text: string };
const listeners = new Set<(t: ToastItem) => void>();
let seq = 0;
export function toast(text: string, tone: "success" | "error" = "success") {
  const item = { id: ++seq, tone, text };
  listeners.forEach((l) => l(item));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const on = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-3), t]);
      setTimeout(() => setItems((prev) => prev.filter((p) => p.id !== t.id)), 5000);
    };
    listeners.add(on);
    return () => {
      listeners.delete(on);
    };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6">
      {items.map((t) => (
        <div key={t.id} className={cn("glass pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-2xl animate-fade-up", t.tone === "error" && "border-danger/40")}>
          {t.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
          <span className="text-cream">{t.text}</span>
          <button aria-label="Fechar aviso" className="ml-auto text-smoke hover:text-cream" onClick={() => setItems((p) => p.filter((x) => x.id !== t.id))}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Execução de Server Actions ──────────────────────────────────────────────

export function useAction<A extends unknown[], T>(action: (...args: A) => Promise<ActionResult<T>>, opts: { successMessage?: string; refresh?: boolean; onSuccess?: (data?: T) => void } = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  // Sempre usa as opções/estado mais recentes (evita closures desatualizadas)
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const run = useCallback(
    (...args: A) =>
      new Promise<ActionResult<T>>((resolve) => {
        setError(null);
        setFieldErrors({});
        startTransition(async () => {
          let res: ActionResult<T>;
          try {
            res = await action(...args);
          } catch {
            res = { ok: false, error: "Falha de conexão. Verifique sua internet e tente novamente." };
          }
          if (res.ok) {
            const o = optsRef.current;
            const msg = res.message ?? o.successMessage;
            if (msg) toast(msg);
            o.onSuccess?.(res.data);
            if (o.refresh !== false) router.refresh();
          } else {
            setError(res.error);
            setFieldErrors(res.fieldErrors ?? {});
            toast(res.error, "error");
          }
          resolve(res);
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action, router],
  );
  return { run, pending, error, fieldErrors };
}

/** Botão que executa uma ação simples (com confirmação opcional) */
export function ActionButton<T>({ action, children, confirm, successMessage, variant = "secondary", size = "sm", className, disabled }: { action: () => Promise<ActionResult<T>>; children: React.ReactNode; confirm?: string; successMessage?: string; variant?: "primary" | "secondary" | "ghost" | "danger" | "outline"; size?: "sm" | "md" | "lg"; className?: string; disabled?: boolean }) {
  const { run, pending } = useAction(action, { successMessage });
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        void run();
      }}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </Button>
  );
}

export function SubmitButton({ pending, children, className, variant = "primary", size = "md" }: { pending: boolean; children: React.ReactNode; className?: string; variant?: "primary" | "secondary" | "danger" | "outline"; size?: "sm" | "md" | "lg" }) {
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={className} aria-busy={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

// ─── Diálogo ─────────────────────────────────────────────────────────────────

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn("glass m-auto w-[calc(100%-2rem)] rounded-2xl p-0 text-cream backdrop:bg-black/70 backdrop:backdrop-blur-sm", wide ? "max-w-3xl" : "max-w-lg")}
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
            <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-smoke hover:bg-white/5 hover:text-cream">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ─── Upload de imagem ────────────────────────────────────────────────────────

export function ImageUpload({ value, onChange, label = "Fotografia", name = "Foto" }: { value: string | null; onChange: (url: string | null) => void; label?: string; name?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  async function onFile(file: File) {
    setErr(null);
    if (file.size > 3 * 1024 * 1024) return setErr("A imagem deve ter no máximo 3 MB.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha no envio");
      onChange(json.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha no envio");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.12em] text-mist">{label}</p>
      <div className="flex items-center gap-4">
        <Avatar name={name} src={value} size={64} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {value ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              Remover
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={`Selecionar ${label.toLowerCase()}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {err && <p className="mt-1.5 text-xs text-danger" role="alert">{err}</p>}
      <p className="mt-1.5 text-xs text-smoke">JPG, PNG ou WebP até 3 MB.</p>
    </div>
  );
}

/** Campo de tags (especialidades) */
export function TagInput({ value, onChange, placeholder = "Digite e pressione Enter", id }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; id?: string }) {
  const [draft, setDraft] = useState("");
  function add() {
    const t = draft.trim();
    if (t.length >= 2 && !value.includes(t) && value.length < 12) onChange([...value, t]);
    setDraft("");
  }
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-coal/80 px-2 py-1.5 focus-within:border-gold/60">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-xs text-gold-soft">
          {t}
          <button type="button" aria-label={`Remover ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? "" : placeholder}
        className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-sm text-cream placeholder:text-smoke/70 focus:outline-none"
      />
    </div>
  );
}
