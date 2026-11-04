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

/** Descarga un .xlsx con los contactos del agente: una columna por cada dato definido. */
export async function downloadLeadsExcel(agentId: string, fields: DataField[], fileBase: string): Promise<number> {
  const { data, error } = await supabase
    .from('leads')
    .select('customer_id,status,source,created_at,updated_at,additional_fields')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw new Error(error.message)
  const leads = (data ?? []) as LeadRow[]

  // Datos guardados que ya no están en la lista de columnas (por si se renombró o quitó alguna)
  const known = new Set(fields.map(f => f.key))
  const extra = new Set<string>()
  leads.forEach(l => Object.keys(l.additional_fields ?? {}).forEach(k => !known.has(k) && extra.add(k)))

  const head = ['Fecha de creación', 'Última actualización', 'Contacto', 'Estado', ...fields.map(f => f.label), ...[...extra]]
  const rows = leads.map(l => [
    fmtDate(l.created_at),
    fmtDate(l.updated_at),
    l.customer_id,
    l.status ?? '',
    ...fields.map(f => String(l.additional_fields?.[f.key] ?? '')),
    ...[...extra].map(k => String(l.additional_fields?.[k] ?? '')),
  ])

  const { default: writeExcelFile } = await import('write-excel-file/browser')
  const sheet = [
    head.map(h => ({ value: h, fontWeight: 'bold' as const })),
    ...rows.map(r => r.map(v => ({ value: v, type: String }))),
  ]
  const stamp = new Date().toISOString().slice(0, 10)
  await writeExcelFile(sheet as never, { columns: head.map(() => ({ width: 24 })) } as never).toFile(`${fileBase}-leads-${stamp}.xlsx`)
  return leads.length
}
