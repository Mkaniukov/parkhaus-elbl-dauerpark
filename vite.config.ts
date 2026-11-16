import type { IncomingMessage } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Lokale Functions, damit `npm run dev` die Verwaltung ohne Netlify CLI bedient. */
function devApiPlugin(): Plugin {
  return {
    name: 'elbl-dev-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }
      if (!process.env.CATALOG_STORE) process.env.CATALOG_STORE = 'file'

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (
          url !== '/.netlify/functions/catalog' &&
          url !== '/.netlify/functions/admin'
        ) {
          next()
          return
        }
        try {
          const mod = (await server.ssrLoadModule(
            url.endsWith('/catalog')
              ? '/netlify/functions/catalog.ts'
              : '/netlify/functions/admin.ts',
          )) as {
            handler: (event: {
              httpMethod?: string
              headers?: IncomingMessage['headers']
              body?: string
            }) => Promise<{
              statusCode: number
              headers?: Record<string, string | number | boolean>
              body?: string
            }>
          }
          const body = await readBody(req)
          const result = await mod.handler({
            httpMethod: req.method,
            headers: req.headers,
            body,
          })
          res.statusCode = result.statusCode
          for (const [key, value] of Object.entries(result.headers ?? {})) {
            res.setHeader(key, String(value))
          }
          res.end(result.body ?? '')
        } catch (err) {
          console.error(err)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Dev-API Fehler' }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
})
