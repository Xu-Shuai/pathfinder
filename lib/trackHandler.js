export async function handleTrack(request) {
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

  try {
    const payload = await request.json()
    if (process.env.NODE_ENV !== 'production') {
      console.info('[track]', JSON.stringify(payload))
    }
  } catch {
    /* sendBeacon 可能发空；仍返回 ok */
  }

  return Response.json(
    { ok: true },
    {
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  )
}
