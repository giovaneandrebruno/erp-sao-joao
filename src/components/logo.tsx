/** Marca "São João ERP": as iniciais "SJ" sobre um quadrado laranja. */
export function Logo({ tamanho = 34 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="sj-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e89a5c" />
          <stop offset="1" stopColor="#d0712a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#sj-g)" />
      <rect x=".5" y=".5" width="31" height="31" rx="7.5" fill="none" stroke="#fff" strokeOpacity=".14" />
      <text x="16" y="21.5" textAnchor="middle" fontFamily="var(--font-plex-sans), system-ui, sans-serif" fontSize="14" fontWeight="700" letterSpacing="-0.5" fill="#fff">SJ</text>
    </svg>
  );
}

export function Marca() {
  return (
    <div className="flex items-center gap-3">
      <Logo />
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-stone-900">
          São João
          <span className="rounded bg-white/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-stone-900 ring-1 ring-inset ring-white/15">ERP</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-stone-500">São João Móveis</div>
      </div>
    </div>
  );
}
