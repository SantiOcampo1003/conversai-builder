import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Image as ImageIcon, Loader2, Paperclip, Plus, Trash2, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
import {
  AgentAssetRow,
  IMAGE_TYPES,
  PDF_TYPES,
  deleteAgentAsset,
  formatSize,
  listAgentAssets,
  setAssetActive,
  toKey,
  uploadAgentAsset,
  validateAssetFile,
} from '@/lib/agent-assets'

const ACCEPTED = [...PDF_TYPES, ...IMAGE_TYPES]

interface Props {
  agentId: string
  clientId: string
}

export function AgentAssetsSection({ agentId, clientId }: Props) {
  const { toast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [assets, setAssets] = useState<AgentAssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [sendWhen, setSendWhen] = useState('')
  const [caption, setCaption] = useState('')

  const load = useCallback(async () => {
    // Solo la primera carga muestra skeleton (estado inicial); recargar tras guardar es silencioso
    try {
      // Las fotos de producto se gestionan en la sección Productos
      const rows = await listAgentAssets(agentId)
      setAssets(rows.filter(r => !r.product_id))
      setLoadError(null)
    } catch (err) {
      setLoadError((err as { message?: string }).message ?? 'Error desconocido')
      setAssets([])
    }
    setLoading(false)
  }, [agentId])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setFile(null); setTitle('')
    setSendWhen(''); setCaption('')
    if (fileInput.current) fileInput.current.value = ''
  }

  const onPickFile = (picked: File | null) => {
    if (!picked) return
    const problem = validateAssetFile(picked, ACCEPTED)
    if (problem) {
      toast({ title: 'Archivo no válido', description: problem, variant: 'destructive' })
      return
    }
    setFile(picked)
    if (!title) {
      const suggested = picked.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
      setTitle(suggested)
    }
  }

  const canSave = !!file && title.trim() !== '' && sendWhen.trim() !== '' && !saving

  const handleSave = async () => {
    if (!file || !canSave) return
    setSaving(true)
    // La clave interna se genera sola a partir del nombre; si ya existe, se le agrega un sufijo
    const base = toKey(title) || 'archivo'
    const taken = new Set(assets.map(a => a.asset_key))
    let assetKey = base
    for (let n = 2; taken.has(assetKey); n++) assetKey = `${base}_${n}`
    try {
      await uploadAgentAsset({
        agentId,
        clientId,
        file,
        title,
        assetKey,
        sendWhen,
        caption,
        sortOrder: assets.length,
      })
      toast({ title: 'Archivo agregado', description: `El agente podrá enviar "${title.trim()}".` })
      resetForm()
      setShowForm(false)
      await load()
    } catch (err) {
      const e = err as { code?: string; message?: string }
      toast({
        title: 'No se pudo guardar',
        description: e.code === '23505' ? 'Ya existe un archivo con ese nombre. Cambia el nombre.' : (e.message ?? 'Error desconocido'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row: AgentAssetRow, active: boolean) => {
    setAssets(prev => prev.map(a => (a.id === row.id ? { ...a, active } : a)))
    try {
      await setAssetActive(row.id, active)
    } catch (err) {
      setAssets(prev => prev.map(a => (a.id === row.id ? { ...a, active: row.active } : a)))
      toast({ title: 'No se pudo actualizar', description: (err as { message?: string }).message, variant: 'destructive' })
    }
  }

  const remove = async (row: AgentAssetRow) => {
    try {
      await deleteAgentAsset(row)
      setAssets(prev => prev.filter(a => a.id !== row.id))
    } catch (err) {
      toast({ title: 'No se pudo eliminar', description: (err as { message?: string }).message, variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
        Sube <strong className="text-foreground">PDFs</strong> (brochures, catálogos, listas) y, si hace falta, imágenes generales.
        Para cada archivo describe <strong className="text-foreground">en qué momento debe enviarlo el agente</strong>, por ejemplo:
        <em> "cuando el cliente pregunte por la convocatoria"</em>. El agente lo envía por WhatsApp después de su respuesta
        y no lo repite en la misma conversación.
        <span className="block mt-2">Las <strong className="text-foreground">fotos de productos</strong> se suben en la sección Productos, junto a cada producto.</span>
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
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium text-foreground/80">Enviar cuando:</span> {row.send_when}
            </p>
            {row.caption && <p className="text-xs text-muted-foreground mt-0.5">Texto: {row.caption}</p>}
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              {row.kind === 'image' ? 'Imagen' : 'PDF'}{formatSize(row.size_bytes) && ` · ${formatSize(row.size_bytes)}`}
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
            <Label>Archivo (PDF o imagen, máx. 20 MB)</Label>
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
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-title">Nombre del archivo</Label>
            <Input
              id="asset-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Brochure de servicios"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="asset-when">¿En qué momento debe enviarlo el agente?</Label>
            <Textarea
              id="asset-when"
              value={sendWhen}
              onChange={e => setSendWhen(e.target.value)}
              placeholder="Cuando el cliente pregunte por los servicios o pida más información"
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
