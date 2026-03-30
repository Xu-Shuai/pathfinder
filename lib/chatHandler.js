import { SYSTEM_PROMPT } from './systemPrompt.js'
import { checkRateLimit } from './rateLimit.js'
import { transformAnthropicToAppStream } from './anthropicTransform.js'
import { transformOpenAICompatibleToAppStream } from './openaiSseTransform.js'
import {
  retrieveYuewenCandidates,
  formatCandidatesForPrompt,
} from './yuewenClient.js'

const MAX_BODY_BYTES = 50 * 1024
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

function buildSystem(preferences) {
  let extra = ''
  if (preferences?.categories?.length) {
    extra += `\n用户选择的类型标签：${preferences.categories.join('、')}。`
  }
  if (preferences?.summary) {
    extra += `\n偏好摘要：${preferences.summary}`
  }
  return SYSTEM_PROMPT + extra
}

function jsonSseError(error, message, extra = {}) {
  const payload = JSON.stringify({ type: 'error', error, message, ...extra })
  return new Response(`data: ${payload}\n\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

function normalizeMessages(messages) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
  }))
}

function shouldRetrieveYuewen(lastUserText, preferences) {
  const enable = String(process.env.YUEWEN_ENABLE || 'false').toLowerCase()
  if (enable === 'false') return false
  if (!lastUserText) return false

  // 触发词：起点系“最新/上新/最近/新书/新番”
  const hit = /起点|最近|最新|上新|新书|新番|小说推荐|番茄/.test(lastUserText)
  if (!hit) return false

  // 如果用户明确选择了“小说”分类，则优先开检索
  const wantsNovel = Array.isArray(preferences?.categories)
    ? preferences.categories.length === 0 || preferences.categories.includes('novel')
    : true
  return wantsNovel
}

async function streamAnthropic({ apiKey, model, system, chatMessages, stream }) {
  return fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream,
      system,
      messages: chatMessages,
    }),
  })
}

async function streamQwen({
  apiKey,
  baseUrl,
  model,
  system,
  chatMessages,
  stream,
  includeUsage,
}) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const openAiMessages = [{ role: 'system', content: system }, ...chatMessages]

  const body = {
    model,
    messages: openAiMessages,
    stream,
  }
  if (includeUsage) {
    body.stream_options = { include_usage: true }
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
}

function missingKeyError(provider) {
  if (provider === 'qwen') {
    return jsonSseError(
      'api_error',
      'Server missing DASHSCOPE_API_KEY (set for AI_PROVIDER=qwen)',
    )
  }
  return jsonSseError(
    'api_error',
    'Server missing ANTHROPIC_API_KEY (or set AI_PROVIDER=qwen for 通义千问)',
  )
}

export async function handleChat(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const cl = request.headers.get('content-length')
  if (cl && Number(cl) > MAX_BODY_BYTES) {
    return jsonSseError('bad_request', 'Body too large')
  }

  if (!checkRateLimit(request)) {
    return jsonSseError('rate_limited', 'Too many requests', { retry_after_s: 30 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return jsonSseError('bad_request', 'Invalid JSON')
  }

  if (JSON.stringify(body).length > MAX_BODY_BYTES) {
    return jsonSseError('bad_request', 'Body too large')
  }

  const { messages, preferences, stream = true } = body
  if (!Array.isArray(messages) || !messages.length) {
    return jsonSseError('bad_request', 'messages required')
  }

  const raw = (process.env.AI_PROVIDER || 'anthropic').toLowerCase()
  const provider = raw === 'qwen' || raw === 'dashscope' ? 'qwen' : 'anthropic'
  const chatMessages = normalizeMessages(messages)
  let system = buildSystem(preferences || {})

  // 1) 可选：阅文候选检索增强（元数据），提升“最近/上新/起点风格”覆盖面
  try {
    const lastUser = [...chatMessages].reverse().find((m) => m.role === 'user')
    if (shouldRetrieveYuewen(lastUser?.content, preferences)) {
      const { candidates } = await retrieveYuewenCandidates({
        query: lastUser.content,
        env: process.env,
      })
      const max = Number(process.env.YUEWEN_BOOKS_FOR_PROMPT || 8)
      const block = formatCandidatesForPrompt(candidates, { max })
      if (block) {
        system += `\n\n[阅文候选作品元数据（用于推荐，不要编造未提供的信息）]\n${block}\n\n请在候选范围内给出更全面的推荐，并根据用户提问匹配风格/节奏/题材；如果候选不足，请坦诚说明。`
      }
    }
  } catch {
    // 检索失败不影响主模型对话
  }

  let upstream

  if (provider === 'qwen') {
    const apiKey = process.env.DASHSCOPE_API_KEY
    if (!apiKey) return missingKeyError('qwen')

    const baseUrl =
      process.env.DASHSCOPE_BASE_URL ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1'
    const model = process.env.QWEN_MODEL || 'qwen-plus'
    const includeUsage = process.env.QWEN_STREAM_USAGE !== 'false'

    upstream = await streamQwen({
      apiKey,
      baseUrl,
      model,
      system,
      chatMessages,
      stream,
      includeUsage,
    })
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return missingKeyError('anthropic')

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    upstream = await streamAnthropic({
      apiKey,
      model,
      system,
      chatMessages,
      stream,
    })
  }

  if (!upstream.ok) {
    let detail = upstream.statusText
    try {
      const err = await upstream.json()
      detail = err.error?.message || err.message || JSON.stringify(err)
    } catch {
      /* ignore */
    }
    return jsonSseError('api_error', detail || 'LLM request failed')
  }

  if (!stream) {
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    })
  }

  const outStream =
    provider === 'qwen'
      ? transformOpenAICompatibleToAppStream(upstream.body)
      : transformAnthropicToAppStream(upstream.body)

  return new Response(outStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
