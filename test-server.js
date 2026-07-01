/* eslint-disable */
/**
 * Servidor de teste (zero dependências) para validar o envio da extensão.
 *
 *   node test-server.js            // escuta em http://localhost:3000
 *   PORT=4000 node test-server.js  // porta custom
 *
 * Na extensão, configure o endpoint como http://localhost:3000/wa/import,
 * clique em "Autorizar host" e depois em "Dump & enviar".
 */
const http = require('http')

const PORT = Number(process.env.PORT) || 3000

// Reconstrói um Buffer a partir do formato { type:'Buffer', data:'<base64>' }.
function fromBufWrap(v) {
  if (v && v.type === 'Buffer' && typeof v.data === 'string') {
    return Buffer.from(v.data, 'base64')
  }
  return null
}

const server = http.createServer((req, res) => {
  // CORS liberado (não é necessário para a extensão, mas ajuda testes via página).
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (!['POST', 'PUT'].includes(req.method)) {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'method not allowed' }))
    return
  }

  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8')
    let dump
    try {
      dump = JSON.parse(raw)
    } catch (e) {
      console.error('[test-server] JSON invalido:', e.message)
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'invalid json' }))
      return
    }

    const d = dump.device || {}
    const noise = fromBufWrap(d.noiseKey && d.noiseKey.privKey)
    const identity = fromBufWrap(d.identityKey && d.identityKey.privKey)

    console.log('\n[test-server] dump recebido (%d bytes) via %s %s', raw.length, req.method, req.url)
    console.log('  regId .............. %s', d.registrationId)
    console.log('  meJid .............. %s', d.meJid)
    console.log('  meLid .............. %s', d.meLid)
    console.log('  noiseKey.priv ...... %s', noise ? noise.length + ' bytes (base64 OK)' : 'ausente')
    console.log('  identityKey.priv ... %s', identity ? identity.length + ' bytes (base64 OK)' : 'ausente')
    console.log('  appStateSyncKeys ... %d', (dump.appStateSyncKeys || []).length)
    console.log('  appStateVersions ... %d', (dump.appStateVersions || []).length)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, receivedBytes: raw.length, meJid: d.meJid || null }))
  })
})

server.listen(PORT, () => {
  console.log('[test-server] ouvindo em http://localhost:%d  (POST/PUT /wa/import)', PORT)
})
