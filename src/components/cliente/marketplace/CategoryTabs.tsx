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
              className={`whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
              }`}
            >
              {category.label}
              {typeof category.count === 'number' && (
                <span className={`ml-1 ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
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
