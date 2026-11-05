import { supabase } from '@/lib/supabase'

export type LineStatus = 'pending' | 'connected' | 'disconnected' | 'error'

export interface WhatsAppLine {
  id: string
  client_id: string
  line_name: string
  phone_number: string | null
  agent_id: string | null
  status: LineStatus
  /** `evolution` = QR (WhatsApp Web); `meta_cloud` = API oficial de Meta. */
  provider: 'evolution' | 'meta_cloud'
  evolution_instance_name: string | null
  meta_phone_number_id: string | null
  meta_waba_id: string | null
  qr_code: string | null
  last_connected_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

const backendBase = () => (import.meta.env.VITE_BACKEND_CHAT_URL as string | undefined)?.replace(/\/$/, '')

/** Llama al backend con la sesión del usuario: el navegador nunca habla con Evolution directamente. */
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = backendBase()
  if (!base) throw new Error('Falta configurar VITE_BACKEND_CHAT_URL')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Inicia sesión de nuevo')

  const res = await fetch(`${base}/api/whatsapp-lines${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(json?.message) ? json.message.join(', ') : json?.message
    throw new Error(message || `Error ${res.status}`)
  }
  return json as T
}

/** Líneas del cliente con el estado real de WhatsApp. `syncError` avisa si se muestra lo último guardado. */
export const listLines = (clientId: string) =>
  call<{ lines: WhatsAppLine[]; syncError: string | null }>('GET', `?clientId=${encodeURIComponent(clientId)}`)

export const createLine = async (clientId: string, lineName: string) =>
  (await call<{ line: WhatsAppLine }>('POST', '', { clientId, lineName })).line

/** Estado actual; si la línea espera escaneo trae el QR vigente. */
export const refreshLine = async (id: string) => (await call<{ line: WhatsAppLine }>('POST', `/${id}/refresh`)).line

export const reconnectLine = async (id: string) => (await call<{ line: WhatsAppLine }>('POST', `/${id}/reconnect`)).line

export const logoutLine = async (id: string) => (await call<{ line: WhatsAppLine }>('POST', `/${id}/logout`)).line

export const deleteLine = async (id: string) => {
  await call<{ ok: true }>('DELETE', `/${id}`)
}
