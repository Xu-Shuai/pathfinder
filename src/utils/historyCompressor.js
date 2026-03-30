import { estimateTokens } from './tokenEstimator.js'

/** 超出预算时保留首条消息 + 尽可能长的尾部上下文 */
export function compressHistory(messages, maxTokens = 12000) {
  if (!messages?.length) return []
  if (estimateTokens(messages) <= maxTokens) return messages

  const first = messages[0]
  for (let i = messages.length - 1; i >= 1; i -= 1) {
    const candidate = [first, ...messages.slice(i)]
    if (estimateTokens(candidate) <= maxTokens) return candidate
  }
  return [first]
}
