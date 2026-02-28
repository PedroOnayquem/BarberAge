import { ArrowRight } from 'lucide-react'

interface PromoBannerProps {
  onExplore: () => void
}

export function PromoBanner({ onExplore }: PromoBannerProps) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[linear-gradient(140deg,#0A1F44_0%,#16346E_62%,#1E3A8A_100%)] p-4 text-white shadow-[var(--shadow-card)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[rgba(177,18,38,0.35)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-[rgba(255,255,255,0.12)] blur-xl" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(255,255,255,0.82)]">Marketplace BarberAge</p>
      <h2 className="mt-2 text-xl font-bold leading-tight">Agende rápido na sua cidade</h2>
      <p className="mt-1 text-sm text-[rgba(255,255,255,0.86)]">Descubra barbearias com agenda ativa e reserve em poucos toques.</p>

      <button
        type="button"
        onClick={onExplore}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
      >
        Explorar
        <ArrowRight size={14} />
      </button>
    </section>
  )
}

