import { useState } from 'react'

export function FeedbackButtons({ onFeedback, onCollect, disabled }) {
  const [picked, setPicked] = useState(null)

  const pick = (feedback_type) => {
    if (disabled || picked) return
    setPicked(feedback_type)
    onFeedback?.(feedback_type)
  }

  return (
    <div className="feedback-row">
      <button
        type="button"
        className={`feedback-btn ${picked === 'like' ? 'is-on' : ''}`}
        aria-label="喜欢"
        disabled={disabled || !!picked}
        onClick={() => pick('like')}
      >
        喜欢
      </button>
      <button
        type="button"
        className={`feedback-btn ${picked === 'dislike' ? 'is-on' : ''}`}
        aria-label="不喜欢"
        disabled={disabled || !!picked}
        onClick={() => pick('dislike')}
      >
        不喜欢
      </button>
      <button
        type="button"
        className={`feedback-btn ${picked === 'inaccurate' ? 'is-on' : ''}`}
        aria-label="信息有误"
        disabled={disabled || !!picked}
        onClick={() => pick('inaccurate')}
      >
        有误
      </button>
      <button
        type="button"
        className="feedback-btn"
        aria-label="收藏"
        disabled={disabled}
        onClick={() => onCollect?.()}
      >
        收藏
      </button>
    </div>
  )
}
