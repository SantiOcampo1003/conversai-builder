import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Loader2, Paperclip, Plus, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const BUCKET = 'agent-assets'
const MAX_BYTES = 20 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const NO_PRODUCT = '__none'

interface AgentAssetRow {
  id: string
  asset_key: string
  kind: 'image' | 'document'
  title: string
  caption: string | null
  send_when: string
  product_ref: string | null
  storage_path: string
  public_url: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  active: boolean
}

interface Props {
  agentId: string
  clientId: string
  productNames: string[]
}

/** "Brochure Cantera 2027" -> "brochure_cantera_2027" (clave que ve el modelo). */
function toKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

function toSafeFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
  return `${toKey(base) || 'archivo'}${ext}`
}

function formatSize(bytes: number | null): string {
  if (!bytes) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`
}

export function AgentAssetsSection({ agentId, clientId, productNames }: Props) {
  const { toast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [assets, setAssets] = useState<AgentAssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [assetKey, setAssetKey] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [sendWhen, setSendWhen] = useState('')
  const [caption, setCaption] = useState('')
  const [productRef, setProductRef] = useState(NO_PRODUCT)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('agent_assets')
      .select('*')
      .eq('agent_id', agentId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      setLoadError(error.message)
      setAssets([])
    } else {
      setLoadError(null)
      setAssets((data ?? []) as AgentAssetRow[])
    }
    setLoading(false)
  }, [agentId])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setFile(null); setTitle(''); setAssetKey(''); setKeyTouched(false)
    setSendWhen(''); setCaption(''); setProductRef(NO_PRODUCT)
    if (fileInput.current) fileInput.current.value = ''
  }

  const onPickFile = (picked: File | null) => {
    if (!picked) return
    if (!ACCEPTED.includes(picked.type)) {
      toast({ title: 'Formato no permitido', description: 'Sube una imagen (JPG, PNG, WebP) o un PDF.', variant: 'destructive' })
      return
    }
    if (picked.size > MAX_BYTES) {
      toast({ title: 'Archivo muy pesado', description: 'El máximo es 20 MB.', variant: 'destructive' })
      return
    }
    setFile(picked)
    if (!title) {
      const suggested = picked.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
      setTitle(suggested)
      if (!keyTouched) setAssetKey(toKey(suggested))
    }
  }

  const isImage = file?.type.startsWith('image/') ?? false
  const canSave = !!file && title.trim() !== '' && assetKey !== '' && sendWhen.trim() !== '' && !saving

  const handleSave = async () => {
    if (!file || !canSave) return
    setSaving(true)
    const path = `${clientId}/${agentId}/${Date.now()}-${toSafeFileName(file.name)}`

    try {
      const { error: upError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upError) throw upError

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

      const { error: insError } = await supabase.from('agent_assets').insert({
        agent_id: agentId,
        asset_key: assetKey,
        kind: isImage ? 'image' : 'document',
        title: title.trim(),
        caption: caption.trim() || null,
        send_when: sendWhen.trim(),
        product_ref: isImage && productRef !== NO_PRODUCT ? productRef : null,
        storage_path: path,
        public_url: pub.publicUrl,
        file_name: isImage ? null : file.name,
        mime_type: file.type,
        size_bytes: file.size,
        sort_order: assets.length,
      })
      if (insError) {
        await supabase.storage.from(BUCKET).remove([path]) // no dejar el archivo huérfano
        throw insError
      }

      toast({ title: 'Archivo agregado', description: `El agente podrá enviar "${title.trim()}".` })
      resetForm()
      setShowForm(false)
      await load()
    } catch (err) {
      const e = err as { code?: string; message?: string }
      const duplicated = e.code === '23505'
      toast({
        title: 'No se pudo guardar',
        description: duplicated ? `Ya existe un archivo con la clave "${assetKey}". Cámbiala.` : (e.message ?? 'Error desconocido'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: AgentAssetRow, active: boolean) => {
    setAssets(prev => prev.map(a => (a.id === row.id ? { ...a, active } : a)))
    const { error } = await supabase.from('agent_assets').update({ active }).eq('id', row.id)
    if (error) {
      setAssets(prev => prev.map(a => (a.id === row.id ? { ...a, active: row.active } : a)))
      toast({ title: 'No se pudo actualizar', description: error.message, variant: 'destructive' })
    }
  }

  const remove = async (row: AgentAssetRow) => {
    const { error } = await supabase.from('agent_assets').delete().eq('id', row.id)
    if (error) {
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' })
      return
    }
    await supabase.storage.from(BUCKET).remove([row.storage_path])
    setAssets(prev => prev.filter(a => a.id !== row.id))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
        Sube imágenes (por ejemplo fotos de productos) y PDFs (brochures, catálogos). Para cada archivo indica
        <strong className="text-foreground"> cuándo debe enviarlo el agente</strong>, por ejemplo:
        <em> "cuando el cliente pregunte por la convocatoria"</em> o <em>"cuando pida ver el producto"</em>.
        El agente lo envía por WhatsApp después de su respuesta y no lo repite en la misma conversación.
      </div>

      {loadError && (
        <p className="text-sm text-destructive">No se pudieron cargar los archivos: {loadError}</p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      ) : (
        assets.length === 0 && !loadError && (
          <p className="text-sm text-muted-foreground">Este agente aún no tiene archivos.</p>
        )
      )}

      {assets.map(row => (
        <div key={row.id} className="flex gap-3 items-start bg-secondary/30 rounded-xl p-3 border border-border">
          {row.kind === 'image' ? (
            <img src={row.public_url} alt={row.title} className="h-16 w-16 rounded-lg object-cover shrink-0 bg-secondary" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground truncate">{row.title}</p>
              <Badge variant="secondary" className="font-mono text-[10px]">{row.asset_key}</Badge>
              {row.product_ref && <Badge variant="outline" className="text-[10px]">{row.product_ref}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium text-foreground/80">Enviar cuando:</span> {row.send_when}
            </p>
            {row.caption && <p className="text-xs text-muted-foreground mt-0.5">Texto: {row.caption}</p>}
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              {row.kind === 'image' ? 'Imagen' : 'PDF'} {formatSize(row.size_bytes) && `· ${formatSize(row.size_bytes)}`}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Switch checked={row.active} onCheckedChange={v => toggleActive(row, v)} aria-label="Activo" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-9 w-9 p-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar archivo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará "{row.title}". El agente dejará de poder enviarlo. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove(row)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}

      {!showForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="gap-2 self-start">
          <Plus className="h-4 w-4" /> Agregar archivo
        </Button>
      ) : (
        <div className="rounded-xl border border-border p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Archivo (imagen o PDF, máx. 20 MB)</Label>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED.join(',')}
              className="hidden"
              onChange={e => onPickFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" size="sm" className="gap-2 self-start" onClick={() => fileInput.current?.click()}>
              {file ? <Paperclip className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {file ? file.name : 'Elegir archivo'}
            </Button>
            {file && isImage && (
              <img src={URL.createObjectURL(file)} alt="Vista previa" className="h-24 w-24 rounded-lg object-cover" />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-title">Nombre</Label>
              <Input
                id="asset-title"
                value={title}
                onChange={e => { setTitle(e.target.value); if (!keyTouched) setAssetKey(toKey(e.target.value)) }}
                placeholder="Brochure Cantera 2027"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-key">Clave interna</Label>
              <Input
                id="asset-key"
                value={assetKey}
                onChange={e => { setKeyTouched(true); setAssetKey(toKey(e.target.value)) }}
                placeholder="brochure_cantera"
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-when">¿Cuándo debe enviarlo el agente?</Label>
            <Textarea
              id="asset-when"
              value={sendWhen}
              onChange={e => setSendWhen(e.target.value)}
              placeholder="Cuando el cliente pregunte por la convocatoria o quiera más información de Cantera"
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-caption">Texto que lo acompaña (opcional)</Label>
            <Input
              id="asset-caption"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Aquí tienes el brochure con toda la información"
            />
          </div>

          {isImage && productNames.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label>Producto al que pertenece (opcional)</Label>
              <Select value={productRef} onValueChange={setProductRef}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PRODUCT}>Ninguno</SelectItem>
                  {productNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!canSave} size="sm" className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              {saving ? 'Subiendo…' : 'Guardar archivo'}
            </Button>
            <Button variant="ghost" size="sm" disabled={saving} onClick={() => { resetForm(); setShowForm(false) }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
