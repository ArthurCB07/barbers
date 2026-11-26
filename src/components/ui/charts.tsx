/** Gráficos SVG leves (server-friendly), com tabela acessível equivalente */

export function BarChart({ data, height = 180, format = (v: number) => String(v), label }: { data: Array<{ label: string; value: number; sub?: string }>; height?: number; format?: (v: number) => string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  const empty = data.every((d) => d.value === 0);
  return (
    <figure>
      <div className="relative" style={{ height }}>
        {empty && <p className="absolute inset-0 flex items-center justify-center text-sm text-smoke">Sem dados no período</p>}
        <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          {[0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1="0" x2="100" y1={height - g * (height - 16)} y2={height - g * (height - 16)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const h = (d.value / max) * (height - 16);
            return (
              <rect key={i} x={i * w + w * 0.18} width={w * 0.64} y={height - h} height={Math.max(h, d.value > 0 ? 1.5 : 0)} rx="0.6" fill="url(#goldBar)">
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
            );
          })}
          <defs>
            <linearGradient id="goldBar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#e2c48f" />
              <stop offset="100%" stopColor="#b87333" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="mt-1 flex text-[10px] text-smoke" aria-hidden>
        {data.map((d, i) => (
          <span key={i} className="flex justify-center overflow-visible whitespace-nowrap" style={{ width: `${w}%` }}>
            {data.length > 16 ? (i % Math.ceil(data.length / 7) === 0 ? d.label : "") : d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><th>{d.label}</th><td>{format(d.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function HBarList({ data, format = (v: number) => String(v) }: { data: Array<{ label: string; value: number; hint?: string }>; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm text-smoke">Sem dados no período.</p>;
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-mist">{d.label}</span>
            <span className="shrink-0 tabular-nums text-cream">{format(d.value)}{d.hint && <span className="ml-1 text-xs text-smoke">{d.hint}</span>}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-copper to-gold-soft" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
