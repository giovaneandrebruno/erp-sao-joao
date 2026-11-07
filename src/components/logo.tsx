/** Marca "Emob Pro": um "E" formado por três prateleiras, sobre gradiente violeta → ciano. */
export function Logo({ tamanho = 34 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="emob-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#00d4f5" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill="url(#emob-g)" />
      <rect x="9" y="8" width="3.2" height="16" rx="1.6" fill="#fff" />
      <rect x="9" y="8" width="14" height="3.2" rx="1.6" fill="#fff" />
      <rect x="9" y="14.4" width="10.5" height="3.2" rx="1.6" fill="#fff" opacity=".85" />
      <rect x="9" y="20.8" width="14" height="3.2" rx="1.6" fill="#fff" />
    </svg>
  );
}

export function Marca() {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-[11px] shadow-[0_0_28px_-4px_rgb(124_92_255/0.8)]"><Logo /></div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-stone-900">
          Emob
          <span className="rounded-md bg-gradient-to-r from-violeta to-ciano px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-white">Pro</span>
        </div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">São João Móveis</div>
      </div>
    </div>
  );
}
