import { useEffect, useRef } from 'react'
import { MessageBubble } from './MessageBubble.jsx'

export function MessageList({ messages, isLoading, track, onCollect }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading])

  return (
    <div className="message-list" role="log" aria-live="polite">
      {messages.map((m, i) => {
        const isLast = i === messages.length - 1
        const isAssistant = m.role === 'assistant'
        const tailStreaming = isLoading && isLast && isAssistant
        return (
          <MessageBubble
            key={m.id || `${i}-${m.role}`}
            role={m.role}
            content={m.content}
            showFeedback={isAssistant && !m.error && !tailStreaming && !!m.content}
            isStreamingTail={tailStreaming}
            onFeedback={(feedback_type) =>
              track?.('feedback_given', {
                feedback_type,
                msg_index: i + 1,
              })
            }
            onCollect={() =>
              onCollect?.({
                title: `推荐片段 ${i + 1}`,
                detail: m.content?.slice(0, 2000) || '',
              })
            }
          />
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
