import { useState } from 'react'
import { ArrowDown, ArrowUp, Download, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  DataField,
  cleanDataFields,
  downloadConversationsExcel,
  downloadLeadsExcel,
  readDataFields,
  toFieldKey,
} from '@/lib/data-fields'

const PRESETS = ['Nombre', 'Teléfono', 'Correo electrónico', 'Ciudad', 'Dirección', 'Empresa', 'Presupuesto']

interface Props {
  agent: { agent_id: string; business_name: string; required_info: string[] | null; data_fields?: unknown }
  saving: boolean
  /** Guarda en la tabla agents. Devuelve true si salió bien. */
  onSave: (patch: { data_fields: DataField[]; required_info: string[] }) => Promise<boolean>
}

export function DataFieldsSection({ agent, saving, onSave }: Props) {
  const { toast } = useToast()
  const [fields, setFields] = useState<DataField[]>(() => readDataFields(agent))
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<null | 'leads' | 'conv'>(null)

  const update = (i: number, patch: Partial<DataField>) =>
    setFields(prev => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  const remove = (i: number) => setFields(prev => prev.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) =>
    setFields(prev => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const add = (label = '') =>
    setFields(prev => [...prev, { key: '', label, description: '', required: true }])

  const save = async () => {
    const res = cleanDataFields(fields)
    if (res.error || !res.fields) { setError(res.error ?? 'Revisa las columnas.'); return }
    setError(null)
    const ok = await onSave({ data_fields: res.fields, required_info: res.fields.map(f => f.key) })
    if (ok) setFields(res.fields)
  }

  const download = async (kind: 'leads' | 'conv') => {
    setDownloading(kind)
    try {
      const res = cleanDataFields(fields)
      const list = res.fields ?? readDataFields(agent)
      const n = kind === 'leads'
        ? await downloadLeadsExcel(agent.agent_id, list, agent.agent_id)
        : await downloadConversationsExcel(agent.agent_id, list, agent.agent_id)
      toast({ title: n ? `Excel descargado (${n} ${kind === 'leads' ? 'contactos' : 'conversaciones'})` : 'Excel descargado (vacío por ahora)' })
    } catch (e) {
      toast({ title: 'No se pudo descargar', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDownloading(null)
    }
  }

  const usedKeys = new Set(fields.map(f => toFieldKey(f.label)))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Estos son los datos que el agente le pide a cada persona. Cada uno es una <strong>columna</strong> en
        Excel y en Google Sheets, y el agente los guarda tal como los dice la persona.
      </p>

      <div className="flex flex-col gap-3">
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
            Todavía no hay datos. Agrega el primero o elige uno de los sugeridos.
          </p>
        )}
        {fields.map((f, i) => (
          <div key={i} className="rounded-lg border p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-5 text-center">{i + 1}</span>
              <Input
                value={f.label}
                onChange={e => update(i, { label: e.target.value })}
                placeholder="Nombre de la columna (ej. Nombre del talento)"
              />
              <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Bajar">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Quitar">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={f.description ?? ''}
              onChange={e => update(i, { description: e.target.value })}
              placeholder="Qué va aquí y cómo llenarlo (ej. solo la edad o el año de nacimiento, nunca el grado)"
            />
            <div className="flex items-center gap-2">
              <Switch checked={f.required} onCheckedChange={v => update(i, { required: v })} id={`req-${i}`} />
              <Label htmlFor={`req-${i}`} className="text-xs text-muted-foreground">
                Obligatorio: el agente lo pide antes de cerrar
              </Label>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Solo pedirlo si</span>
              <select
                value={f.only_when?.field ?? ''}
                onChange={e => update(i, { only_when: e.target.value ? { field: e.target.value, in: f.only_when?.in ?? [] } : undefined })}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">(siempre se pide)</option>
                {fields.filter((o, idx) => idx !== i && o.label.trim()).map(o => (
                  <option key={o.key || o.label} value={o.key || toFieldKey(o.label)}>{o.label}</option>
                ))}
              </select>
              {f.only_when && (
                <>
                  <span>es uno de:</span>
                  <Input
                    value={f.only_when.in.join(', ')}
                    onChange={e => update(i, { only_when: { field: f.only_when!.field, in: e.target.value.split(',').map(v => v.trimStart()) } })}
                    placeholder="valores separados por coma, ej. CLAN Football Academy, Cantera CLAN"
                    className="h-7 text-xs flex-1 min-w-[220px]"
                  />
                </>
              )}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => add()} className="gap-2">
            <Plus className="h-4 w-4" /> Agregar dato
          </Button>
          {PRESETS.filter(p => !usedKeys.has(toFieldKey(p))).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => add(p)}
              className="px-2.5 py-1 rounded-lg text-xs border border-border text-muted-foreground hover:border-primary/40"
            >
              + {p}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar datos
        </Button>
        <Button variant="outline" onClick={() => download('leads')} disabled={downloading !== null} className="gap-2">
          {downloading === 'leads' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Excel: listos para closer
        </Button>
        <Button variant="outline" onClick={() => download('conv')} disabled={downloading !== null} className="gap-2">
          {downloading === 'conv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Excel: seguimiento de conversaciones
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Cada contacto tiene una etapa: «En conversación» mientras falte algún dato obligatorio y «Listo para closer» cuando ya los tiene todos. El primer Excel trae solo los listos; el segundo trae todas las conversaciones, también las que no dieron datos. Cambiar el nombre de una columna no pierde datos.
      </p>
    </div>
  )
}
