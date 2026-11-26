import Link from "next/link";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ name, href = "/", className, compact }: { name: string; href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label={`${name} — início`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/40 bg-gradient-to-br from-wood/70 to-coal text-gold shadow-[0_0_20px_-6px_rgba(200,161,101,0.6)]">
        <Scissors className="h-4 w-4 -rotate-45" />
      </span>
      {!compact && <span className="font-display text-xl font-semibold tracking-wide text-cream group-hover:text-gold-soft">{name}</span>}
    </Link>
  );
}
