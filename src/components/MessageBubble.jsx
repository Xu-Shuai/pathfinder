import Markdown from 'react-markdown'
import { FeedbackButtons } from './FeedbackButtons.jsx'
import { TypingIndicator } from './TypingIndicator.jsx'

export function MessageBubble({
  role,
  content,
  showFeedback,
  onFeedback,
  onCollect,
  isStreamingTail,
}) {
  const user = role === 'user'

  return (
    <div className={`bubble-row ${user ? 'bubble-row--user' : 'bubble-row--ai'}`}>
      <div className={`bubble ${user ? 'bubble--user' : 'bubble--ai'}`}>
        {user ? (
          <p className="bubble-text">{content}</p>
        ) : (
          <div className="bubble-md">
            {isStreamingTail && !content ? (
              <TypingIndicator />
            ) : (
              <Markdown>{content}</Markdown>
            )}
          </div>
        )}
      </div>
      {!user && showFeedback && (
        <FeedbackButtons
          disabled={isStreamingTail}
          onFeedback={onFeedback}
          onCollect={onCollect}
        />
      )}
    </div>
  )
}
