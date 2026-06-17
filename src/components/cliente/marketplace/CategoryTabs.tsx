interface Category {
  id: string
  label: string
  count?: number
}

interface CategoryTabsProps {
  categories: Category[]
  activeCategory: string
  onCategoryChange: (id: string) => void
}

export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="inline-flex min-w-full gap-2 py-1 md:flex md:flex-wrap">
        {categories.map((category) => {
          const isActive = activeCategory === category.id
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? 'brand-gradient-bg border-white/20 text-white shadow-[0_12px_24px_rgba(123,97,255,0.18)]'
                  : 'border-[var(--color-border)] bg-white/[0.055] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.08]'
              }`}
            >
              {category.label}
              {typeof category.count === 'number' && (
                <span className={`ml-1 ${isActive ? 'text-white/78' : 'text-[var(--color-text-muted)]'}`}>
                  ({category.count})
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
