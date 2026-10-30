import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  AgentAssetRow,
  IMAGE_TYPES,
  deleteAgentAsset,
  toKey,
  uploadAgentAsset,
  validateAssetFile,
} from '@/lib/agent-assets'

interface Props {
  agentId: string
  clientId: string
  productId: string
  productName: string
  photos: AgentAssetRow[]
  /** Garantiza que el producto ya está guardado en el agente antes de ligarle una foto. */
  ensureSaved: () => Promise<boolean>
  onChanged: () => void | Promise<void>
}

/** Fotos de un producto: el agente las envía por WhatsApp cuando el cliente quiere ver el producto. */
export function ProductPhotos({ agentId, clientId, productId, productName, photos, ensureSaved, onChanged }: Props) {
  const { toast } = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const canUpload = productName.trim() !== ''

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list = Array.from(files)

    for (const f of list) {
      const problem = validateAssetFile(f, IMAGE_TYPES)
      if (problem) {
        toast({ title: `No se pudo usar "${f.name}"`, description: problem, variant: 'destructive' })
        if (input.current) input.current.value = ''
        return
      }
    }

    setBusy(true)
    try {
      if (!(await ensureSaved())) return
      const base = toKey(productName).slice(0, 40) || 'producto'
      let order = photos.length
      for (const f of list) {
        const suffix = Math.random().toString(36).slice(2, 6)
        await uploadAgentAsset({
          agentId,
          clientId,
          file: f,
          title: productName.trim(),
          assetKey: `${base}_${suffix}`,
          productId,
          sortOrder: order++,
        })
      }
      await onChanged()
    } catch (err) {
      const e = err as { message?: string }
      toast({ title: 'No se pudo subir la foto', description: e.message ?? 'Error desconocido', variant: 'destructive' })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const handleDelete = async (row: AgentAssetRow) => {
    setBusy(true)
    try {
      await deleteAgentAsset(row)
      await onChanged()
    } catch (err) {
      const e = err as { message?: string }
      toast({ title: 'No se pudo eliminar la foto', description: e.message ?? 'Error desconocido', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {photos.map(row => (
        <div key={row.id} className="relative h-14 w-14 shrink-0">
          <img
            src={row.public_url}
            alt={row.title}
            className={`h-14 w-14 rounded-lg object-cover bg-secondary ${row.active ? '' : 'opacity-40'}`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => handleDelete(row)}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-destructive"
            aria-label="Eliminar foto"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy || !canUpload}
        onClick={() => input.current?.click()}
        title={canUpload ? 'Agregar foto del producto' : 'Ponle nombre al producto para agregar fotos'}
        className="h-14 px-3 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {photos.length === 0 ? 'Agregar foto' : 'Otra foto'}
      </button>
    </div>
  )
}
