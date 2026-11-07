/** Marca "Veio": um bloco de madeira com os veios em curva. */
export function Logo({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#a8703f" />
      <path d="M6 10c5-3 9 3 14 0s6-2 6-2" stroke="#f2e8dc" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M6 16c5-3 9 3 14 0s6-2 6-2" stroke="#f2e8dc" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".75" />
      <path d="M6 22c5-3 9 3 14 0s6-2 6-2" stroke="#f2e8dc" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}

export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo />
      <div className="leading-tight">
        <div className={`text-lg font-bold tracking-tight ${claro ? "text-white" : "text-grafite"}`}>Veio</div>
        <div className={`text-xs ${claro ? "text-stone-400" : "text-stone-500"}`}>São João Móveis</div>
      </div>
    </div>
  );
}
