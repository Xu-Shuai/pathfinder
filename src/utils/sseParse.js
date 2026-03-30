const dec = new TextDecoder()

export async function parseSseStream(body, { onTextDelta, onStop, onError }, signal) {
  if (!body) {
    onError?.(new Error('Empty body'))
    return
  }
  const reader = body.getReader()
  let buffer = ''
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const { done, value } = await reader.read()
      if (done) break
      buffer += dec.decode(value, { stream: true })
      let lineEnd
      while ((lineEnd = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, lineEnd).replace(/\r$/, '')
        buffer = buffer.slice(lineEnd + 1)
        if (!line.startsWith('data:')) continue
        const json = line.slice(5).trim()
        if (!json) continue
        let evt
        try {
          evt = JSON.parse(json)
        } catch {
          continue
        }
        if (evt.type === 'text_delta' && evt.text) onTextDelta?.(evt.text)
        if (evt.type === 'message_stop') onStop?.(evt.usage)
        if (evt.type === 'error') {
          onError?.(
            Object.assign(new Error(evt.message || evt.error || 'Stream error'), {
              code: evt.error,
              retry_after_s: evt.retry_after_s,
            }),
          )
          break
        }
      }
    }
  } catch (e) {
    if (e?.name === 'AbortError') return
    onError?.(e)
  }
}
