import type { Handler } from '@netlify/functions'
import { loadCatalog } from './catalogStore'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store',
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }),
    }
  }
  const loaded = await loadCatalog()
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify({
      ok: true,
      source: loaded.source,
      garagen: loaded.publicCatalog.garagen,
      settings: loaded.publicCatalog.settings,
    }),
  }
}
