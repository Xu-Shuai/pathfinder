/** 粗略估算 token 数（约 4 字符/token，中文偏保守） */
export function estimateTokens(messages) {
  if (!messages?.length) return 0
  const text = messages.map((m) => (typeof m.content === 'string' ? m.content : '')).join('\n')
  return Math.ceil(text.length / 3)
}
