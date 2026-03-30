import { useCallback, useRef, useState } from 'react'
import { parseSseStream } from '../utils/sseParse.js'

export function useStreaming() {
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef(null)

  const abortStream = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const streamPost = useCallback(async (url, jsonBody, handlers) => {
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal
    setIsStreaming(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonBody),
        signal,
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || res.statusText)
      }
      await parseSseStream(res.body, handlers, signal)
    } finally {
      setIsStreaming(false)
    }
  }, [])

  return { isStreaming, abortStream, streamPost }
}
