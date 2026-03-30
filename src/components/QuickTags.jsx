import { QUICK_TAGS } from '../config/constants.js'

export function QuickTags({ onPick }) {
  return (
    <div className="quick-tags" role="list">
      {QUICK_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          className="chip chip--ghost"
          onClick={() => onPick(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
