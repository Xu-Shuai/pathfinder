import { useCallback, useRef, useState } from 'react'
import { useStreaming } from './useStreaming.js'
import { useTokenManager } from './useTokenManager.js'

export function useChat({ preferences, onUsage, onError }) {
  const [messages, setMessages] = useState([])
  const { isStreaming, abortStream, streamPost } = useStreaming()
  const { compressHistory } = useTokenManager()
  const messagesRef = useRef([])

  const resetChat = useCallback(() => {
    abortStream()
    messagesRef.current = []
    setMessages([])
  }, [abortStream])

  const sendMessage = useCallback(
    async (text) => {
      const prev = messagesRef.current
      const userMsg = { role: 'user', content: text }
      const next = [...prev, userMsg]
      messagesRef.current = next
      setMessages(next)

      const payloadMessages = compressHistory(next, 12000).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const assistantShell = {
        role: 'assistant',
        content: '',
        id: crypto.randomUUID(),
      }
      messagesRef.current = [...next, assistantShell]
      setMessages((m) => [...m, assistantShell])

      try {
        await streamPost(
          '/api/chat',
          { messages: payloadMessages, preferences, stream: true },
          {
            onTextDelta: (t) => {
              setMessages((list) => {
                const copy = [...list]
                const last = copy[copy.length - 1]
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, content: last.content + t }
                }
                messagesRef.current = copy
                return copy
              })
            },
            onStop: (usage) => {
              onUsage?.(usage)
            },
            onError: (err) => {
              if (err?.name === 'AbortError') return
              onError?.(err)
              setMessages((list) => {
                const copy = [...list]
                const last = copy[copy.length - 1]
                const msg = `出错了：${err.message || err.error || '未知错误'}`
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = {
                    ...last,
                    content: last.content ? `${last.content}\n\n（${msg}）` : msg,
                    error: true,
                  }
                } else {
                  copy.push({
                    role: 'assistant',
                    content: msg,
                    error: true,
                    id: crypto.randomUUID(),
                  })
                }
                messagesRef.current = copy
                return copy
              })
            },
          },
        )
      } catch (e) {
        if (e?.name === 'AbortError') {
          setMessages((list) => {
            const copy = [...list]
            const last = copy[copy.length - 1]
            if (last?.role === 'assistant' && !last.content) copy.pop()
            messagesRef.current = copy
            return copy
          })
          return
        }
        setMessages((list) => {
          const copy = [...list]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant' && !last.content) {
            copy[copy.length - 1] = {
              ...last,
              content: `请求失败：${e.message}`,
              error: true,
            }
          }
          messagesRef.current = copy
          return copy
        })
      }
    },
    [compressHistory, onError, onUsage, preferences, streamPost],
  )

  return {
    messages,
    isLoading: isStreaming,
    sendMessage,
    resetChat,
    abortStream,
  }
}
