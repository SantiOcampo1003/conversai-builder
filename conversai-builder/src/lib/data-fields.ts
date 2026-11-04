import { supabase } from '@/lib/supabase'

/** Un dato que recoge el agente. Misma forma que backend/src/common/types/agent.types.ts (DataField). */
export interface DataField {
  key: string
  label: string
  description?: string
  required: boolean
}

/** "Nombre del talento" -> "nombre_del_talento" (clave técnica estable). */
export function toFieldKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

function humanize(key: string): string {
  const t = key.replace(/_/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : key
}

/** Datos del agente: data_fields si existe; si no, se derivan de required_info (agentes antiguos). */
export function readDataFields(agent: {
  data_fields?: unknown
  required_info?: string[] | null
}): DataField[] {
  if (Array.isArray(agent.data_fields) && agent.data_fields.length > 0) {
    return (agent.data_fields as Partial<DataField>[]).map(f => ({
      key: String(f.key ?? ''),
      label: String(f.label ?? ''),
      description: f.description ? String(f.description) : '',
      required: f.required !== false,
    }))
  }
  return (agent.required_info ?? []).map(k => ({
    key: toFieldKey(k),
    label: humanize(k),
    description: '',
    required: true,
  }))
}

/** Valida y limpia la lista antes de guardar. Devuelve el error en español o la lista lista para guardar. */
export function cleanDataFields(fields: DataField[]): { fields?: DataField[]; error?: string } {
  const seen = new Set<string>()
  const out: DataField[] = []
  for (const f of fields) {
    const label = f.label.trim()
    if (!label) return { error: 'Todas las columnas necesitan un nombre.' }
    const key = f.key ? toFieldKey(f.key) : toFieldKey(label)
    if (!key) return { error: `La columna "${label}" necesita letras o números en el nombre.` }
    if (seen.has(key)) return { error: `Hay dos columnas que quedan con la misma clave ("${key}"). Cambia el nombre de una.` }
    seen.add(key)
    out.push({ key, label, description: f.description?.trim() || '', required: f.required })
  }
  return { fields: out }
}

/** Etapas de un contacto, iguales para todos los agentes (misma lógica que el backend: langchain/lead-stage.ts). */
export const STAGE_IN_PROGRESS = 'En conversación'
export const STAGE_READY = 'Listo para closer'

const hasValue = (v: unknown) => v != null && String(v).trim() !== ''

export function computeStage(fields: DataField[], additional: Record<string, unknown> | null | undefined) {
  const data = additional ?? {}
  const required = fields.filter(f => f.required !== false)
  const missing = required.filter(f => !hasValue(data[f.key]))
  const complete = required.length > 0 && missing.length === 0
  return { complete, label: complete ? STAGE_READY : STAGE_IN_PROGRESS, missing }
}

/** "573059357319" o "573059357319@s.whatsapp.net" -> teléfono; los "@lid" no son teléfonos. */
export function phoneFromContactId(contactId: string | null | undefined): string | null {
  const id = (contactId ?? '').trim()
  if (id.includes('@lid')) return null
  const digits = id.replace(/@.*$/, '')
  return /^\d{8,15}$/.test(digits) ? digits : null
}

interface LeadRow {
  customer_id: string
  status: string | null
  source: string | null
  created_at: string
  updated_at: string
  additional_fields: Record<string, unknown> | null
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })

type Row = string[]

async function saveExcel(head: string[], rows: Row[], fileName: string) {
  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const sheet = [
    head.map(h => ({ value: h, fontWeight: 'bold' as const })),
    ...rows.map(r => r.map(v => ({ value: v, type: String }))),
  ]
  await writeExcelFile(sheet as never, { columns: head.map(() => ({ width: 24 })) } as never).toFile(fileName)
}

const stamp = () => new Date().toISOString().slice(0, 10)

/**
 * Excel para el closer: SOLO contactos con todos los datos obligatorios (etapa "Listo para closer").
 * Una columna por cada dato definido, más el teléfono cuando se conoce.
 */
export async function downloadLeadsExcel(agentId: string, fields: DataField[], fileBase: string): Promise<number> {
  const { data, error } = await supabase
    .from('leads')
    .select('customer_id,status,source,created_at,updated_at,additional_fields')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw new Error(error.message)
  const ready = ((data ?? []) as LeadRow[]).filter(l => computeStage(fields, l.additional_fields).complete)

  // Datos guardados que ya no están en la lista de columnas (por si se renombró o quitó alguna)
  const known = new Set(fields.map(f => f.key))
  const extra = new Set<string>()
  ready.forEach(l => Object.keys(l.additional_fields ?? {}).forEach(k => !known.has(k) && extra.add(k)))

  const head = ['Fecha de creación', 'Última actualización', 'Contacto', 'Teléfono', 'Etapa', ...fields.map(f => f.label), ...[...extra]]
  const rows = ready.map(l => [
    fmtDate(l.created_at),
    fmtDate(l.updated_at),
    l.customer_id,
    phoneFromContactId(l.customer_id) ?? '',
    STAGE_READY,
    ...fields.map(f => String(l.additional_fields?.[f.key] ?? '')),
    ...[...extra].map(k => String(l.additional_fields?.[k] ?? '')),
  ])
  await saveExcel(head, rows, `${fileBase}-listos-para-closer-${stamp()}.xlsx`)
  return rows.length
}

interface MsgRow { user_id: string; role: string; message: string; created_at: string }

/**
 * Excel de seguimiento: TODAS las conversaciones del agente, también las que no dieron ningún dato.
 * Sirve para ver en qué etapa está cada una: "En conversación" o "Listo para closer".
 */
export async function downloadConversationsExcel(agentId: string, fields: DataField[], fileBase: string): Promise<number> {
  // El historial puede ser grande: se lee por páginas
  const msgs: MsgRow[] = []
  const PAGE = 1000
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await supabase
      .from('chat_history')
      .select('user_id,role,message,created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    msgs.push(...((data ?? []) as MsgRow[]))
    if (!data || data.length < PAGE) break
  }

  const { data: leadData, error: leadErr } = await supabase
    .from('leads')
    .select('customer_id,additional_fields')
    .eq('agent_id', agentId)
    .limit(5000)
  if (leadErr) throw new Error(leadErr.message)
  const leadByContact = new Map((leadData ?? []).map(l => [l.customer_id as string, (l.additional_fields ?? {}) as Record<string, unknown>]))

  const byContact = new Map<string, MsgRow[]>()
  for (const m of msgs) {
    if (m.user_id.startsWith('test_')) continue // pruebas internas
    byContact.set(m.user_id, [...(byContact.get(m.user_id) ?? []), m])
  }

  const trunc = (t: string) => (t.length > 200 ? `${t.slice(0, 200)}…` : t).replace(/\s+/g, ' ')

  const items = [...byContact.entries()].map(([contact, list]) => {
    const data = leadByContact.get(contact) ?? {}
    const stage = computeStage(fields, data)
    const lastUser = [...list].reverse().find(m => m.role === 'user')
    const last = list[list.length - 1]
    return {
      lastAt: last.created_at,
      row: [
        contact,
        phoneFromContactId(contact) ?? '',
        stage.label,
        stage.complete ? '' : stage.missing.map(f => f.label).join(', '),
        String(list.filter(m => m.role === 'user').length),
        fmtDate(list[0].created_at),
        fmtDate(last.created_at),
        last.role === 'user' ? 'Persona (sin responder)' : 'Agente',
        lastUser ? trunc(lastUser.message) : '',
        ...fields.map(f => String(data[f.key] ?? '')),
      ] as Row,
    }
  }).sort((a, b) => b.lastAt.localeCompare(a.lastAt))

  const head = [
    'Contacto', 'Teléfono', 'Etapa', 'Datos que faltan', 'Mensajes de la persona',
    'Primer mensaje', 'Último mensaje', 'Último mensaje de', 'Último texto de la persona',
    ...fields.map(f => f.label),
  ]
  await saveExcel(head, items.map(i => i.row), `${fileBase}-seguimiento-conversaciones-${stamp()}.xlsx`)
  return items.length
}
