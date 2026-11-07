/** Marca "Veio": três veios da madeira em curva, sobre um gradiente violeta → ciano. */
export function Logo({ tamanho = 34 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="veio-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#00e5ff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#veio-g)" />
      <path d="M7 11c4.5-3 8.5 3 13 0s5-2 5-2" stroke="#06060b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M7 16.5c4.5-3 8.5 3 13 0s5-2 5-2" stroke="#06060b" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".7" />
      <path d="M7 22c4.5-3 8.5 3 13 0s5-2 5-2" stroke="#06060b" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".4" />
    </svg>
  );
}

export function Marca() {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-[11px] shadow-[0_0_28px_-4px_rgb(124_92_255/0.8)]"><Logo /></div>
      <div className="leading-tight">
        <div className="text-lg font-semibold tracking-tight text-stone-900">veio</div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">São João Móveis</div>
      </div>
    </div>
  );
}
