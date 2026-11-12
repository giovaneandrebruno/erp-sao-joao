/** Marca "Emob Pro": um "E" formado por três prateleiras, sobre um quadrado azul-marinho. */
export function Logo({ tamanho = 34 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="emob-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f6fe0" />
          <stop offset="1" stopColor="#173a74" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#emob-g)" />
      <rect x=".5" y=".5" width="31" height="31" rx="7.5" fill="none" stroke="#fff" strokeOpacity=".14" />
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
      <Logo />
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-stone-900">
          Emob
          <span className="rounded bg-white/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-stone-900 ring-1 ring-inset ring-white/15">Pro</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">São João Móveis</div>
      </div>
    </div>
  );
}
