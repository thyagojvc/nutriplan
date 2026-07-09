// =============================================================================
// NutriPlan — Meta Conversions API (server-side)
// Envia o evento Purchase direto do servidor no webhook da Hotmart, sem depender
// do pixel do navegador (que é bloqueado por ~25% dos usuários e se perde no
// redirect cross-domain para a Hotmart).
// =============================================================================

import { createHash } from 'node:crypto'

const PIXEL_ID = '931028066102655'
const API_URL = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`

function sha256(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex')
}

export interface FbPurchasePayload {
  email: string
  transactionId?: string
  value: number
  currency: string
  fbc?: string | null
  fbp?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
  firstName?: string | null
  lastName?: string | null
  /** Já normalizado: só dígitos, com código do país (ex: 5511999999999) */
  phone?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  /** Documento único do comprador (ex: CPF), usado como external_id */
  externalId?: string | null
}

export interface FbInitiateCheckoutPayload {
  orderId: string
  value: number
  currency: string
  fbc?: string | null
  fbp?: string | null
  clientIpAddress?: string | null
  clientUserAgent?: string | null
}

export async function sendFacebookInitiateCheckout(payload: FbInitiateCheckoutPayload): Promise<void> {
  const token = process.env.FB_CONVERSIONS_API_TOKEN
  if (!token) return

  const userData: Record<string, string> = {}
  if (payload.fbc) userData.fbc = payload.fbc
  if (payload.fbp) userData.fbp = payload.fbp
  if (payload.clientIpAddress) userData.client_ip_address = payload.clientIpAddress
  if (payload.clientUserAgent) userData.client_user_agent = payload.clientUserAgent

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          {
            event_name: 'InitiateCheckout',
            event_time: Math.floor(Date.now() / 1000),
            event_id: `initiate_checkout_${payload.orderId}`,
            action_source: 'website',
            user_data: userData,
            custom_data: {
              value: payload.value,
              currency: payload.currency.toUpperCase(),
              content_name: 'NutriPlan',
            },
          },
        ],
        access_token: token,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[fb-capi] InitiateCheckout falhou', res.status, text)
    }
  } catch (err) {
    console.error('[fb-capi] erro ao enviar InitiateCheckout:', err)
  }
}

export async function sendFacebookPurchase(payload: FbPurchasePayload): Promise<void> {
  const token = process.env.FB_CONVERSIONS_API_TOKEN
  if (!token) return

  const userData: Record<string, string | string[]> = {
    em: [sha256(payload.email)],
  }
  if (payload.fbc) userData.fbc = payload.fbc
  if (payload.fbp) userData.fbp = payload.fbp
  if (payload.clientIpAddress) userData.client_ip_address = payload.clientIpAddress
  if (payload.clientUserAgent) userData.client_user_agent = payload.clientUserAgent
  if (payload.firstName) userData.fn = [sha256(payload.firstName)]
  if (payload.lastName) userData.ln = [sha256(payload.lastName)]
  if (payload.phone) userData.ph = [sha256(payload.phone)]
  if (payload.city) userData.ct = [sha256(payload.city)]
  if (payload.state) userData.st = [sha256(payload.state)]
  if (payload.zip) userData.zp = [sha256(payload.zip)]
  if (payload.externalId) userData.external_id = [sha256(payload.externalId)]

  const event: Record<string, unknown> = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    user_data: userData,
    custom_data: {
      value: payload.value,
      currency: payload.currency.toUpperCase(),
    },
  }

  // event_id usado como chave de dedupe; se futuramente um pixel client-side
  // disparar Purchase com o mesmo event_id, o Meta descarta o duplicado.
  if (payload.transactionId) {
    event.event_id = `purchase_${payload.transactionId}`
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [event],
        access_token: token,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[fb-capi] Purchase falhou', res.status, text)
    } else {
      const json = await res.json()
      console.info('[fb-capi] Purchase enviado', json)
    }
  } catch (err) {
    console.error('[fb-capi] erro ao enviar Purchase:', err)
  }
}
