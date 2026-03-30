/**
 * 将 Anthropic SSE 流转换为文档约定的 SSE：text_delta / message_stop / error
 */
const encoder = new TextEncoder()

async function* readSseLines(body) {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += dec.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '')
      buffer = buffer.slice(idx + 1)
      if (line.length) yield line
    }
  }
  if (buffer.trim()) yield buffer.trim()
}

function sseLine(obj) {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
}

export function transformAnthropicToAppStream(anthropicBody) {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  ;(async () => {
    let usage = { input_tokens: 0, output_tokens: 0 }
    let currentEvent = ''
    try {
      for await (const line of readSseLines(anthropicBody)) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim()
          continue
        }
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (raw === '[DONE]') continue
        let data
        try {
          data = JSON.parse(raw)
        } catch {
          continue
        }
        if (currentEvent === 'error' || data.type === 'error') {
          await writer.write(
            sseLine({
              type: 'error',
              error: 'api_error',
              message: data.error?.message || data.message || 'Upstream error',
            }),
          )
          break
        }
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          const text = data.delta.text
          if (text) await writer.write(sseLine({ type: 'text_delta', text }))
        }
        if (data.type === 'message_delta' && data.usage) {
          usage = {
            input_tokens: data.usage.input_tokens ?? usage.input_tokens,
            output_tokens: data.usage.output_tokens ?? usage.output_tokens,
          }
        }
      }
      await writer.write(sseLine({ type: 'message_stop', usage }))
    } catch (e) {
      await writer.write(
        sseLine({
          type: 'error',
          error: 'api_error',
          message: e?.message || String(e),
        }),
      )
    } finally {
      await writer.close()
    }
  })()

  return readable
}
