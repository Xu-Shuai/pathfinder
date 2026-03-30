export function QuickSuggestions({ items, onPick, disabled }) {
  if (!items?.length) return null
  return (
    <div className="quick-suggestions">
      {items.map((t) => (
        <button
          key={t}
          type="button"
          className="chip chip--ghost"
          disabled={disabled}
          onClick={() => onPick(t)}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
