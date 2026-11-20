import type { Handler } from '@netlify/functions'
import { applicationPayloadSchema } from '../../src/lib/schema'
import { deliverSavedApplication, deliveryAuthorized } from './submit'

/**
 * Netlify erkennt das Suffix `-background` und antwortet dem Aufrufer sofort mit 202.
 * Vertrag und beide E-Mails laufen danach weiter, auch wenn Google länger braucht.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }
  const header = event.headers['x-elbl-job']
  if (!deliveryAuthorized(header)) {
    console.error('deliver-application: unauthorized')
    return { statusCode: 401, body: 'unauthorized' }
  }

  let raw: unknown
  try {
    raw = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: 'invalid json' }
  }
  const body = raw as { data?: unknown; recordId?: unknown }
  const parsed = applicationPayloadSchema.safeParse(body.data)
  if (!parsed.success) {
    console.error('deliver-application: payload', parsed.error.issues)
    return { statusCode: 400, body: 'invalid payload' }
  }
  const recordId =
    typeof body.recordId === 'string' && body.recordId.trim().length > 0
      ? body.recordId.trim()
      : null

  try {
    const result = await deliverSavedApplication({ data: parsed.data, recordId })
    if (!result.ok) {
      console.error('deliver-application:', result.error)
      return { statusCode: result.status, body: result.error }
    }
    console.info('deliver-application: fertig', { mailSkipped: result.mailSkipped, recordId })
    return { statusCode: 200, body: 'ok' }
  } catch (error) {
    console.error('deliver-application: unhandled', error)
    return { statusCode: 500, body: 'error' }
  }
}
