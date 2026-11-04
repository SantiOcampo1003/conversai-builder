/** Misma lógica que el backend (notifications/notification-format.ts): solo dígitos; celular colombiano de 10 dígitos -> 57 + número. */
export function normalizePhone(input: string): string | null {
  let d = (input ?? '').replace(/\D/g, '')
  if (d.length === 10 && d.startsWith('3')) d = `57${d}`
  return d.length >= 8 && d.length <= 15 ? d : null
}

export const DEFAULT_TEMPLATE = `Hola 👋 Se cerró un nuevo contacto y ya puedes gestionarlo.

{{resumen}}

WhatsApp del contacto: {{whatsapp_link}}`

export interface RecipientRow {
  id?: string
  match_value: string
  phone: string
  label: string
  enabled: boolean
}

export interface LogRow {
  id: string
  customer_id: string
  recipient_phone: string
  recipient_label: string | null
  status: 'sent' | 'failed'
  error: string | null
  is_test: boolean
  created_at: string
}
