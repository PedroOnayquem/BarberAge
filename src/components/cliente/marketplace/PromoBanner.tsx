import { ArrowRight } from 'lucide-react'

interface PromoBannerProps {
  onExplore: () => void
}

export function PromoBanner({ onExplore }: PromoBannerProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-white shadow-[var(--shadow-card)] sm:p-5">
      <p className="text-xs font-semibold text-[var(--color-accent)]">Marketplace BarberAge</p>
      <h2 className="mt-2 text-xl font-bold leading-tight">Agende rápido na sua cidade</h2>
      <p className="mt-1 text-sm leading-6 text-[rgba(255,255,255,0.76)]">Descubra empresas locais com agenda ativa e reserve em poucos toques.</p>

      <button
        type="button"
        onClick={onExplore}
        className="brand-gradient-bg mt-4 inline-flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-white shadow-[0_14px_32px_rgba(123,97,255,0.24)] transition-all hover:-translate-y-0.5 hover:brightness-110"
      >
        Explorar
        <ArrowRight size={14} />
      </button>
    </section>
  )
}
