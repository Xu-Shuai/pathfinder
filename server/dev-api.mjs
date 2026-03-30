import 'dotenv/config'
import http from 'node:http'
import { Readable } from 'node:stream'
import { handleChat } from '../lib/chatHandler.js'
import { handleTrack } from '../lib/trackHandler.js'

const PORT = Number(process.env.PORT_API || 8787)

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

function sendWebResponse(nodeRes, webRes) {
  nodeRes.statusCode = webRes.status
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return
    nodeRes.setHeader(key, value)
  })
  if (!webRes.body) {
    nodeRes.end()
    return
  }
  const nodeReadable = Readable.fromWeb(webRes.body)
  nodeReadable.on('error', () => nodeRes.destroy())
  nodeRes.on('error', () => nodeReadable.destroy())
  nodeReadable.pipe(nodeRes)
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `127.0.0.1:${PORT}`
  const u = new URL(req.url || '/', `http://${host}`)
  const path = u.pathname

  if (path !== '/api/chat' && path !== '/api/track') {
    res.statusCode = 404
    res.end('Not found')
    return
  }

  try {
    let body
    if (req.method === 'POST') body = await readBody(req)

    const webReq = new Request(u.toString(), {
      method: req.method,
      headers: req.headers,
      body: body?.length ? body : undefined,
    })

    const handler = path === '/api/chat' ? handleChat : handleTrack
    const webRes = await handler(webReq)
    sendWebResponse(res, webRes)
  } catch (e) {
    console.error(e)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end('Internal error')
    }
  }
})

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(
      `[pathfinder] 端口 ${PORT} 已被占用（常见于上次 dev 未退出）。请关闭占用进程，或在 .env 里设置 PORT_API=8788 等其它端口，并与 Vite 代理一致。`,
    )
  } else {
    console.error('[pathfinder] dev API 监听失败:', err)
  }
  process.exitCode = 1
})

server.listen(PORT, '127.0.0.1', () => {
  console.info(`[pathfinder] dev API http://127.0.0.1:${PORT}`)
})
