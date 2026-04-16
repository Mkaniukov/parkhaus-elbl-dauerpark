/**
 * Supabase Edge Function (Deno): Google-Doc aus Template kopieren, Platzhalter ersetzen,
 * URL in dauerpark_antraege.contract_pdf_url speichern.
 *
 * Aufruf:
 * - Database Webhook (INSERT/UPDATE auf dauerpark_antraege) mit Payload { record, type, table }
 * - Direkt: POST JSON { "record_id": "<uuid>" }
 *
 * Secrets (Supabase Dashboard → Edge Functions → Secrets):
 * - GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_PROJECT_ID, GOOGLE_DOC_ID
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (meist automatisch gesetzt)
 *
 * Service Account braucht Zugriff auf die Vorlage (Freigabe „Bearbeiten“).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"
import { google } from "npm:googleapis@144.0.0"
import { JWT } from "npm:google-auth-library@9.14.2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

type Row = {
  id: string
  name_firma: string
  adresse: string
  tarif: string
  beginn: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  })
}

function splitNameFirma(nameFirma: string): { name: string; surname: string } {
  const t = nameFirma.trim()
  if (!t) return { name: "—", surname: "—" }
  const parts = t.split(/\s+/u)
  if (parts.length === 1) return { name: parts[0]!, surname: "—" }
  return { name: parts[0]!, surname: parts.slice(1).join(" ") }
}

function formatDateDE(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim())
  if (!m) return isoDate
  return `${m[3]}.${m[2]}.${m[1]}`
}

/** Preis-Anzeige aus Tarif-Spalte (ID); ohne Label-Tabelle: kompakte Darstellung */
function formatPriceDisplay(tarif: string): string {
  const s = tarif.trim()
  if (!s) return "—"
  const after = s.includes("__") ? s.split("__").pop() ?? s : s
  const num = after.match(/\d{2,4}/g)
  if (num?.length) return num.map((n) => `${n},00 €`).join(" / ")
  return s
}

function getGoogleJwt() {
  const email = Deno.env.get("GOOGLE_CLIENT_EMAIL")
  const rawKey = Deno.env.get("GOOGLE_PRIVATE_KEY")
  if (!email || !rawKey) {
    throw new Error("GOOGLE_CLIENT_EMAIL oder GOOGLE_PRIVATE_KEY fehlt")
  }
  if (!Deno.env.get("GOOGLE_PROJECT_ID")) {
    console.warn("GOOGLE_PROJECT_ID nicht gesetzt (optional, für GCP-Logs)")
  }
  const key = rawKey.replace(/\\n/g, "\n")
  return new JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents",
    ],
  })
}

function extractRecordId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const o = payload as Record<string, unknown>
  if (typeof o.record_id === "string" && o.record_id.length > 0) return o.record_id
  const rec = o.record
  if (rec && typeof rec === "object") {
    const id = (rec as Record<string, unknown>).id
    if (typeof id === "string") return id
  }
  if (typeof o.id === "string") return o.id
  return null
}

/** GOOGLE_DOC_ID darf nur die ID sein; aus voller URL oder `…/edit?tab=…` extrahieren. */
function normalizeGoogleDocId(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  const fromDocs = /\/document\/d\/([a-zA-Z0-9_-]+)/.exec(t)
  if (fromDocs) return fromDocs[1]!
  const fromShort = /\/d\/([a-zA-Z0-9_-]+)/.exec(t)
  if (fromShort) return fromShort[1]!
  let id = t.split("/")[0] ?? t
  id = (id.split("?")[0] ?? id).trim()
  return id
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method Not Allowed" }, 405)
  }

  const templateId = normalizeGoogleDocId(Deno.env.get("GOOGLE_DOC_ID") ?? "")
  if (!templateId) {
    return jsonResponse({ ok: false, error: "GOOGLE_DOC_ID fehlt oder ungültig" }, 500)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(
      { ok: false, error: "SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt" },
      500,
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: "Ungültiges JSON" }, 400)
  }

  const recordId = extractRecordId(body)
  if (!recordId) {
    return jsonResponse(
      {
        ok: false,
        error:
          "record_id oder record.id erforderlich (Webhook-Payload oder { record_id })",
      },
      400,
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: row, error: fetchErr } = await supabase
    .from("dauerpark_antraege")
    .select(
      "id, name_firma, adresse, tarif, beginn",
    )
    .eq("id", recordId)
    .maybeSingle()

  if (fetchErr) {
    console.error("Supabase select", fetchErr)
    return jsonResponse({ ok: false, error: fetchErr.message }, 500)
  }
  if (!row) {
    return jsonResponse({ ok: false, error: "Datensatz nicht gefunden" }, 404)
  }

  const r = row as Row
  const { name, surname } = splitNameFirma(r.name_firma)
  const address = r.adresse
  const price = formatPriceDisplay(r.tarif)
  const date = formatDateDE(r.beginn)

  try {
    const auth = getGoogleJwt()
    const drive = google.drive({ version: "v3", auth })
    const docs = google.docs({ version: "v1", auth })

    const copyName = `Dauerparkvertrag ${r.name_firma}`.slice(0, 200)
    const { data: copied } = await drive.files.copy({
      fileId: templateId,
      requestBody: { name: copyName },
      fields: "id, webViewLink",
      supportsAllDrives: true,
    })

    const newId = copied?.id
    if (!newId) {
      throw new Error("Drive copy: keine neue Datei-ID")
    }

    const requests = [
      { replaceAllText: { containsText: { text: "{{name}}", matchCase: false }, replaceText: name } },
      { replaceAllText: { containsText: { text: "{{surname}}", matchCase: false }, replaceText: surname } },
      { replaceAllText: { containsText: { text: "{{address}}", matchCase: false }, replaceText: address } },
      { replaceAllText: { containsText: { text: "{{price}}", matchCase: false }, replaceText: price } },
      { replaceAllText: { containsText: { text: "{{date}}", matchCase: false }, replaceText: date } },
    ]

    await docs.documents.batchUpdate({
      documentId: newId,
      requestBody: { requests },
    })

    const docUrl = `https://docs.google.com/document/d/${newId}/edit`

    const { error: upErr } = await supabase
      .from("dauerpark_antraege")
      .update({ contract_pdf_url: docUrl })
      .eq("id", recordId)

    if (upErr) {
      console.error("Supabase update contract_pdf_url", upErr)
      return jsonResponse(
        { ok: false, error: upErr.message, document_id: newId, doc_url: docUrl },
        500,
      )
    }

    return jsonResponse({
      ok: true,
      document_id: newId,
      contract_pdf_url: docUrl,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("generate-contract", e)
    return jsonResponse({ ok: false, error: msg }, 500)
  }
})
