import { CATEGORIES } from '../config/constants.js'

export function CategorySelector({ value, onChange }) {
  return (
    <div className="category-selector" role="group" aria-label="内容类型">
      {CATEGORIES.map((c) => {
        const active = value.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            className={`chip ${active ? 'chip--active' : ''}`}
            aria-pressed={active}
            onClick={() => {
              onChange(
                active ? value.filter((x) => x !== c.id) : [...value, c.id],
              )
            }}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
