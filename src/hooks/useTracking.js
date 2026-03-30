import { useCallback, useEffect, useRef, useState } from 'react'

const SID_KEY = 'pathfinder-sid'

function getOrCreateSessionId() {
  try {
    let id = sessionStorage.getItem(SID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SID_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function useTracking() {
  const [sessionId] = useState(() => getOrCreateSessionId())
  const roundRef = useRef(0)

  const track = useCallback((eventName, data = {}) => {
    const payload = JSON.stringify({
      event: eventName,
      data: { session_id: sessionId, ...data },
      timestamp: new Date().toISOString(),
    })
    const blob = new Blob([payload], { type: 'application/json' })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', blob)
    } else {
      fetch('/api/track', {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {})
    }
  }, [sessionId])

  const nextMsgIndex = useCallback(() => {
    roundRef.current += 1
    return roundRef.current
  }, [])

  useEffect(() => {
    track('session_start', {
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      referrer: document.referrer || '',
    })
  }, [track])

  return { track, sessionId, nextMsgIndex }
}
