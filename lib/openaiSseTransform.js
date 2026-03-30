/**
 * OpenAI 兼容流式响应（阿里云 DashScope 千问等）→ 应用统一 SSE：text_delta / message_stop / error
 * 参考：data: {"choices":[{"delta":{"content":"..."}}]} 与可选的 usage
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

export function transformOpenAICompatibleToAppStream(upstreamBody) {
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  ;(async () => {
    let usage = { input_tokens: 0, output_tokens: 0 }
    try {
      for await (const line of readSseLines(upstreamBody)) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (raw === '[DONE]') break
        let data
        try {
          data = JSON.parse(raw)
        } catch {
          continue
        }
        const errMsg = data.error?.message || data.message
        if (data.error || errMsg) {
          await writer.write(
            sseLine({
              type: 'error',
              error: 'api_error',
              message: errMsg || JSON.stringify(data.error || data),
            }),
          )
          break
        }
        const choice = data.choices?.[0]
        const piece = choice?.delta?.content
        if (typeof piece === 'string' && piece.length) {
          await writer.write(sseLine({ type: 'text_delta', text: piece }))
        }
        if (data.usage) {
          usage = {
            input_tokens: data.usage.prompt_tokens ?? data.usage.input_tokens ?? usage.input_tokens,
            output_tokens:
              data.usage.completion_tokens ?? data.usage.output_tokens ?? usage.output_tokens,
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
