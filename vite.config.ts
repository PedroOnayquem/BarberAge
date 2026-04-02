import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { AddressLookupError, geocodeAddressServer, lookupCepServer } from './server/addressProxy'

function sendJson(res: import('node:http').ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

type AddressApiServer = Pick<ViteDevServer, 'middlewares'> | Pick<PreviewServer, 'middlewares'>

function registerAddressApiMiddleware(server: AddressApiServer) {
  server.middlewares.use(async (req, res, next) => {
    if (!req.url) return next()

    const url = new URL(req.url, 'http://localhost')
    const isAddressEndpoint = url.pathname === '/api/cep' || url.pathname === '/api/geocode'
    if (!isAddressEndpoint) return next()

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' })
      return
    }

    try {
      if (url.pathname === '/api/cep') {
        const cep = url.searchParams.get('cep') || ''
        const payload = await lookupCepServer(cep)
        sendJson(res, 200, payload)
        return
      }

      const payload = await geocodeAddressServer({
        address: url.searchParams.get('address'),
        street: url.searchParams.get('street'),
        number: url.searchParams.get('number'),
        neighborhood: url.searchParams.get('neighborhood'),
        city: url.searchParams.get('city'),
        state: url.searchParams.get('state'),
        cep: url.searchParams.get('cep'),
      })
      sendJson(res, 200, payload)
    } catch (error) {
      if (error instanceof AddressLookupError) {
        sendJson(res, error.status, { error: error.code, message: error.message })
        return
      }

      sendJson(res, 500, { error: 'internal_error', message: 'Falha inesperada no endpoint local de endereco.' })
    }
  })
}

function localAddressApiPlugin(): Plugin {
  return {
    name: 'local-address-api',
    configureServer(server) {
      registerAddressApiMiddleware(server)
    },
    configurePreviewServer(server) {
      registerAddressApiMiddleware(server)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), localAddressApiPlugin()],
})
