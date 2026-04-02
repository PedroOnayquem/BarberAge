import type { IncomingMessage, ServerResponse } from 'node:http'
import { AddressLookupError, geocodeAddressServer } from '../server/addressProxy'

type ApiRequest = IncomingMessage & { method?: string; url?: string }
type ApiResponse = ServerResponse<IncomingMessage> & { status?: (code: number) => ApiResponse; json?: (payload: unknown) => void }

function sendJson(res: ApiResponse, statusCode: number, payload: unknown) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(statusCode).json(payload)
    return
  }

  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'method_not_allowed' })
    return
  }

  const url = new URL(req.url || '/', 'http://localhost')
  const address = url.searchParams.get('address')
  const street = url.searchParams.get('street')
  const number = url.searchParams.get('number')
  const neighborhood = url.searchParams.get('neighborhood')
  const city = url.searchParams.get('city')
  const state = url.searchParams.get('state')
  const cep = url.searchParams.get('cep')

  try {
    const data = await geocodeAddressServer({
      address,
      street,
      number,
      neighborhood,
      city,
      state,
      cep,
    })
    sendJson(res, 200, data)
  } catch (error) {
    if (error instanceof AddressLookupError) {
      sendJson(res, error.status, { error: error.code, message: error.message })
      return
    }

    sendJson(res, 500, { error: 'internal_error', message: 'Falha inesperada na geocodificacao' })
  }
}
