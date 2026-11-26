/**
 * Componentes de interface reutilizáveis (estilo shadcn/ui, sem dependências).
 * Sem hooks: utilizáveis em Server e Client Components.
 */
import Link from "next/link";
import { forwardRef } from "react";
import { cn, initials } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-b from-gold-soft to-gold text-ink shadow-[0_8px_30px_-10px_rgba(200,161,101,0.7)] hover:brightness-110",
  secondary: "bg-slate text-cream hover:bg-line border border-line",
  ghost: "text-mist hover:text-cream hover:bg-white/5",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
  outline: "border border-gold/40 text-gold-soft hover:bg-gold/10",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-10 w-10 justify-center",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }>(
  ({ variant = "primary", size = "md", className, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />
  ),
);
Button.displayName = "Button";

export function LinkButton({ href, variant = "primary", size = "md", className, children, ...rest }: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

const fieldBase =
  "w-full rounded-xl border border-line bg-coal/80 px-3.5 text-sm text-cream placeholder:text-smoke/70 transition focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:opacity-60 aria-[invalid=true]:border-danger/70";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(fieldBase, "h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-3", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, "h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23b9b2a5' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")" }} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ htmlFor, children, className, hint }: { htmlFor?: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 flex items-baseline justify-between text-xs font-medium uppercase tracking-[0.12em] text-mist", className)}>
      <span>{children}</span>
      {hint && <span className="normal-case tracking-normal text-smoke">{hint}</span>}
    </label>
  );
}

export function Field({ label, htmlFor, error, hint, children, className }: { label: string; htmlFor?: string; error?: string | string[]; hint?: string; children: React.ReactNode; className?: string }) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} hint={hint}>{label}</Label>
      {children}
      {msg && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {msg}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, description, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; description?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line bg-coal accent-[#c8a165]" {...props} />
      <span>
        <span className="text-cream">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-smoke">{description}</span>}
      </span>
    </label>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line/80 bg-graphite/70 p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, action }: { children: React.ReactNode; className?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className={cn("text-sm font-semibold uppercase tracking-[0.14em] text-mist", className)}>{children}</h2>
      {action}
    </div>
  );
}

type Tone = "neutral" | "gold" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-white/5 text-mist border-white/10",
  gold: "bg-gold/10 text-gold-soft border-gold/30",
  success: "bg-success/10 text-success border-success/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  info: "bg-info/10 text-info border-info/30",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}

export const STATUS_TONE: Record<string, Tone> = {
  PENDING: "warning",
  CONFIRMED: "gold",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "neutral",
  APPROVED: "success",
  NEEDS_INFO: "info",
  REJECTED: "danger",
  INACTIVE: "neutral",
  INVITED: "info",
  VOIDED: "neutral",
  OPEN: "warning",
  PAID: "success",
};

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-gold/30 bg-gradient-to-br from-wood to-graphite font-display text-gold-soft", className)} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

export function StatCard({ label, value, hint, icon, tone = "gold" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; tone?: "gold" | "copper" | "neutral" }) {
  return (
    <Card className="relative overflow-hidden p-4 sm:p-5">
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl", tone === "gold" ? "bg-gold/12" : tone === "copper" ? "bg-copper/12" : "bg-white/[0.04]")} />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-smoke">{label}</p>
        {icon && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">{icon}</span>}
      </div>
      <p className="relative mt-3 text-[26px] font-semibold leading-none tracking-tight text-cream tabular-nums">{value}</p>
      {hint && <p className="relative mt-2 text-xs leading-snug text-smoke">{hint}</p>}
    </Card>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold text-cream sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-smoke">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 text-gold/70">{icon}</div>}
      <p className="font-medium text-cream">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-smoke">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-line/80", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("border-b border-line bg-coal/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-smoke", className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("border-b border-line/60 px-4 py-3 align-middle text-mist", className)}>{children}</td>;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warning" | "success" | "danger"; title?: string; children: React.ReactNode }) {
  const map = { info: "border-info/30 bg-info/5 text-info", warning: "border-warning/30 bg-warning/5 text-warning", success: "border-success/30 bg-success/5 text-success", danger: "border-danger/30 bg-danger/5 text-danger" };
  return (
    <div role="status" className={cn("rounded-xl border px-4 py-3 text-sm", map[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={cn(title && "mt-0.5", "text-cream/85")}>{children}</div>
    </div>
  );
}
