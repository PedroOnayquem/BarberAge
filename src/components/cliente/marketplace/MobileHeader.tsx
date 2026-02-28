import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useState, type RefObject } from 'react'
import type { MarketplaceCityOption } from './types'

interface MobileHeaderProps {
  cityFilter: string
  stateFilter: string
  stateOptions: string[]
  cityOptions: MarketplaceCityOption[]
  onCityFilterChange: (value: string) => void
  onStateFilterChange: (value: string) => void
  sortMode: 'relevance' | 'name'
  onSortModeChange: (value: 'relevance' | 'name') => void
  onClearFilters: () => void
  searchInputRef: RefObject<HTMLInputElement | null>
}

export function MobileHeader({
  cityFilter,
  stateFilter,
  stateOptions,
  cityOptions,
  onCityFilterChange,
  onStateFilterChange,
  sortMode,
  onSortModeChange,
  onClearFilters,
  searchInputRef,
}: MobileHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const hasActiveFilters = !!cityFilter.trim() || !!stateFilter

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
      <div className="space-y-3 px-4 pb-3 pt-3 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]">
              <img
                src="/apple-touch-icon.png"
                alt="Ícone BarberAge"
                className="h-5 w-5 object-contain sm:h-6 sm:w-6"
                loading="eager"
                decoding="async"
              />
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--color-text)]">BarberAge</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">Explorar barbearias</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
              filtersOpen || hasActiveFilters
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text)]'
            }`}
            aria-label="Abrir filtros"
          >
            <SlidersHorizontal size={18} />
            {hasActiveFilters && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            )}
          </button>
        </div>

        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            ref={searchInputRef}
            value={cityFilter}
            onChange={(e) => onCityFilterChange(e.target.value)}
            list="mobile-city-suggestions"
            placeholder="Buscar por cidade..."
            className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-input-bg)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
          />
          <datalist id="mobile-city-suggestions">
            {cityOptions.map((cityOption) => (
              <option
                key={`${cityOption.city}-${cityOption.state || 'sem-uf'}`}
                value={cityOption.city}
                label={cityOption.state ? `${cityOption.city} - ${cityOption.state}` : cityOption.city}
              />
            ))}
          </datalist>
        </div>

        {filtersOpen && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-[var(--shadow-card)]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              UF
            </label>
            <select
              value={stateFilter}
              onChange={(e) => onStateFilterChange(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
            >
              <option value="">Todas</option>
              {stateOptions.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>

            <label className="mb-1.5 mt-3 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              Ordenar por
            </label>
            <select
              value={sortMode}
              onChange={(e) => onSortModeChange(e.target.value as 'relevance' | 'name')}
              className="w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/25"
            >
              <option value="relevance">Relevância</option>
              <option value="name">Nome (A-Z)</option>
            </select>

            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-[var(--color-text-muted)]">Filtros rápidos do marketplace</p>
              <button
                type="button"
                onClick={onClearFilters}
                disabled={!hasActiveFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)] disabled:opacity-50"
              >
                <X size={12} />
                Limpar
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
