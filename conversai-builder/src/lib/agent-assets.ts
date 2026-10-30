import { supabase } from '@/lib/supabase'

export const ASSETS_BUCKET = 'agent-assets'
export const MAX_ASSET_BYTES = 20 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PDF_TYPES = ['application/pdf']

export interface AgentAssetRow {
  id: string
  agent_id: string
  asset_key: string
  kind: 'image' | 'document'
  title: string
  caption: string | null
  send_when: string | null
  product_id: string | null
  storage_path: string
  public_url: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  active: boolean
  sort_order: number
}

/** "Brochure Cantera 2027" -> "brochure_cantera_2027" (clave que ve el modelo). */
export function toKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

export function toSafeFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
  return `${toKey(base) || 'archivo'}${ext}`
}

export function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

/** Devuelve un mensaje de error si el archivo no es válido para subir; null si está bien. */
export function validateAssetFile(file: File, allowed: string[]): string | null {
  if (!allowed.includes(file.type)) {
    return allowed === IMAGE_TYPES
      ? 'Sube una imagen JPG, PNG o WebP.'
      : 'Sube una imagen (JPG, PNG, WebP) o un PDF.'
  }
  if (file.size > MAX_ASSET_BYTES) return 'El archivo pesa más de 20 MB.'
  return null
}

export async function listAgentAssets(agentId: string): Promise<AgentAssetRow[]> {
  const { data, error } = await supabase
    .from('agent_assets')
    .select('*')
    .eq('agent_id', agentId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as AgentAssetRow[]
}

export interface UploadAssetParams {
  agentId: string
  clientId: string
  file: File
  title: string
  assetKey: string
  sendWhen?: string | null
  caption?: string | null
  productId?: string | null
  sortOrder?: number
}

/** Sube el archivo al bucket y crea la fila. Si la fila falla, borra el archivo para no dejarlo huérfano. */
export async function uploadAgentAsset(p: UploadAssetParams): Promise<AgentAssetRow> {
  const isImage = p.file.type.startsWith('image/')
  const path = `${p.clientId}/${p.agentId}/${Date.now()}-${toSafeFileName(p.file.name)}`

  const { error: upError } = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(path, p.file, { contentType: p.file.type, upsert: false })
  if (upError) throw upError

  const { data: pub } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path)

  const { data, error } = await supabase
    .from('agent_assets')
    .insert({
      agent_id: p.agentId,
      asset_key: p.assetKey,
      kind: isImage ? 'image' : 'document',
      title: p.title.trim(),
      caption: p.caption?.trim() || null,
      send_when: p.sendWhen?.trim() || null,
      product_id: p.productId ?? null,
      storage_path: path,
      public_url: pub.publicUrl,
      file_name: isImage ? null : p.file.name,
      mime_type: p.file.type,
      size_bytes: p.file.size,
      sort_order: p.sortOrder ?? 0,
    })
    .select()
    .single()

  if (error) {
    await supabase.storage.from(ASSETS_BUCKET).remove([path])
    throw error
  }
  return data as AgentAssetRow
}

export async function setAssetActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('agent_assets').update({ active }).eq('id', id)
  if (error) throw error
}

export async function deleteAgentAsset(row: Pick<AgentAssetRow, 'id' | 'storage_path'>): Promise<void> {
  const { error } = await supabase.from('agent_assets').delete().eq('id', row.id)
  if (error) throw error
  await supabase.storage.from(ASSETS_BUCKET).remove([row.storage_path])
}

/** Borra las fotos cuyo producto ya no existe en la lista guardada del agente. */
export async function pruneProductAssets(agentId: string, validProductIds: string[]): Promise<void> {
  const rows = (await listAgentAssets(agentId)).filter(r => r.product_id && !validProductIds.includes(r.product_id))
  for (const row of rows) await deleteAgentAsset(row)
}
