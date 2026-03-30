import md5 from 'blueimp-md5'

const YUEWEN_BASE_URL = 'https://api.yuewen.com/content/cp/ServiceBus.do'

function formatDateYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function deriveAppToken(appKey) {
  // Official rule (see open.yuewen.com/docs/1002.html#tyqmsf):
  // appToken = first 12 chars of MD5( last4(appKey) + yyyyMMdd ).
  const last4 = String(appKey).slice(-4)
  const raw = last4 + formatDateYmd()
  return String(md5(raw)).slice(0, 12)
}

function hashString(str) {
  // FNV-1a
  let h = 2166136261
  const s = String(str)
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pickPageNos({ totalCount, pageSize, query, pagesPerQuery }) {
  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize))
  const base = hashString(query) % maxPage
  const half = Math.floor(pagesPerQuery / 2)
  const pageNos = []
  for (let i = 0; i < pagesPerQuery; i += 1) {
    const p = base + (i - half)
    const clamped = Math.min(maxPage, Math.max(1, p))
    pageNos.push(clamped)
  }
  // De-dup while keeping order
  return [...new Set(pageNos)]
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs) {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: ac.signal })
    const text = await res.text()
    let json
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`Non-JSON response: ${text.slice(0, 200)}`)
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${json?.returnMsg || res.statusText}`)
    }
    return json
  } finally {
    clearTimeout(t)
  }
}

async function yuewenCpNovel({ appKey, appToken, action, params, timeoutMs }) {
  const u = new URL(YUEWEN_BASE_URL)
  u.searchParams.set('service', 'CpNovel')
  u.searchParams.set('action', action)
  u.searchParams.set('appKey', appKey)
  u.searchParams.set('appToken', appToken)
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue
    u.searchParams.set(k, String(v))
  }

  const json = await fetchJsonWithTimeout(
    u.toString(),
    { method: 'GET', headers: { Accept: 'application/json' } },
    timeoutMs,
  )

  if (json.returnCode !== 0) {
    throw new Error(`Yuewen returnCode=${json.returnCode} returnMsg=${json.returnMsg}`)
  }
  return json.result
}

async function fetchBookList({ appKey, appToken, pageNo, pageSize, timeoutMs }) {
  const result = await yuewenCpNovel({
    appKey,
    appToken,
    action: 'booklist',
    params: { pageNo, pageSize },
    timeoutMs,
  })
  return {
    cbids: result?.cbids || [],
    totalCount: Number(result?.totalCount || 0),
  }
}

async function fetchBookInfo({ appKey, appToken, cbid, timeoutMs }) {
  const result = await yuewenCpNovel({
    appKey,
    appToken,
    action: 'bookinfo',
    params: { CBID: cbid },
    timeoutMs,
  })
  return result?.book || null
}

async function mapLimit(items, limit, fn) {
  const out = []
  let idx = 0
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (idx < items.length) {
      const cur = idx
      idx += 1
      out[cur] = await fn(items[cur], cur)
    }
  })
  await Promise.all(runners)
  return out
}

function toPromptCandidate(book) {
  const title = book?.title || ''
  const author = book?.authorname || ''
  const introRaw = book?.intro || ''
  const intro = String(introRaw).replace(/\s+/g, ' ').trim().slice(0, 120)
  const tag = book?.tag ? String(book.tag).slice(0, 80) : ''
  const coverurl = book?.coverurl || ''
  const status = Number(book?.status || 0)
  const isFinished = status === 50
  return {
    id: String(book?.cBID || book?.CBID || ''),
    title,
    author,
    intro,
    tag,
    coverurl,
    isFinished,
  }
}

export async function retrieveYuewenCandidates({ query, env }) {
  const appKey = env?.YUEWEN_APP_KEY
  if (!appKey) return { candidates: [], skipped: 'missing_app_key' }

  const appToken = env?.YUEWEN_APP_TOKEN || deriveAppToken(appKey)
  const pageSize = Number(env?.YUEWEN_PAGE_SIZE || 20)
  const pagesPerQuery = Number(env?.YUEWEN_PAGES_PER_QUERY || 3)
  const bookInfoLimit = Number(env?.YUEWEN_BOOKINFO_LIMIT || 20)
  const maxParallel = Number(env?.YUEWEN_MAX_PARALLEL || 5)
  const timeoutMs = Number(env?.YUEWEN_TIMEOUT_MS || 8000)

  // 先取第一页拿 totalCount
  const first = await fetchBookList({
    appKey,
    appToken,
    pageNo: 1,
    pageSize,
    timeoutMs,
  })
  if (!first.cbids.length) return { candidates: [], skipped: 'empty_booklist' }

  const pageNos = pickPageNos({
    totalCount: first.totalCount || 0,
    pageSize,
    query,
    pagesPerQuery,
  })

  // 拉取多个分页 cbids
  const pages = await mapLimit(
    pageNos,
    Math.min(pageNos.length, maxParallel),
    async (pno) => {
      try {
        return await fetchBookList({
          appKey,
          appToken,
          pageNo: pno,
          pageSize,
          timeoutMs,
        })
      } catch {
        return { cbids: [], totalCount: first.totalCount }
      }
    },
  )

  const unique = new Set()
  const cbids = []
  for (const page of pages) {
    for (const id of page.cbids || []) {
      const v = String(id)
      if (!unique.has(v)) {
        unique.add(v)
        cbids.push(v)
      }
    }
  }

  const targetIds = cbids.slice(0, bookInfoLimit)
  const books = await mapLimit(targetIds, maxParallel, async (cbid) => {
    try {
      return await fetchBookInfo({ appKey, appToken, cbid, timeoutMs })
    } catch {
      return null
    }
  })

  const candidates = books.filter(Boolean).map(toPromptCandidate)
  return { candidates, skipped: null }
}

export function formatCandidatesForPrompt(candidates, { max = 8 } = {}) {
  const list = (candidates || []).slice(0, max)
  if (!list.length) return ''
  return list
    .map((c, i) => {
      const status = c.isFinished ? '已完结' : '连载'
      const intro = c.intro ? `简介：${c.intro}` : '简介：暂无'
      const tag = c.tag ? `标签：${c.tag}` : ''
      return `#${i + 1}《${c.title}》（作者：${c.author}；${status}）\n${tag ? tag + '\\n' : ''}${intro}`
    })
    .join('\n\n')
}

