/** 简易滑动窗口限流（边缘实例内有效；生产可换 KV/Redis） */
const WINDOW_MS = 60_000
const MAX_REQUESTS = 5

const store = () => {
  const g = globalThis
  if (!g.__pathfinderRate) g.__pathfinderRate = new Map()
  return g.__pathfinderRate
}

function clientIp(request) {
  const xf = request.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0]?.trim() || 'unknown'
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

export function checkRateLimit(request) {
  const ip = clientIp(request)
  const now = Date.now()
  const m = store()
  let list = m.get(ip)
  if (!list) {
    list = []
    m.set(ip, list)
  }
  const pruned = list.filter((t) => now - t < WINDOW_MS)
  pruned.push(now)
  m.set(ip, pruned)
  return pruned.length <= MAX_REQUESTS
}
