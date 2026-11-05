import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Loader2, RefreshCw, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

const backendBase = () => (import.meta.env.VITE_BACKEND_CHAT_URL as string | undefined)?.replace(/\/$/, '')

interface Integration {
  id: string
  enabled: boolean
  only_complete: boolean
  spreadsheet_id: string
  sheet_name: string
  last_sync_at: string | null
  last_error: string | null
}

/** Acepta el enlace completo de Google Sheets o el id solo. */
function parseSpreadsheetId(input: string): string | null {
  const text = input.trim()
  const m = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{20,})/)
  if (m) return m[1]
  return /^[a-zA-Z0-9-_]{20,}$/.test(text) ? text : null
}

async function callBackend(path: string, agentId: string) {
  const base = backendBase()
  if (!base) throw new Error('Falta configurar VITE_BACKEND_CHAT_URL')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Vuelve a iniciar sesión')
  const res = await fetch(`${base}/api/integrations/google-sheets/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ agentId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`)
  return json as { ok: boolean; error: string | null; rows?: number }
}

export function GoogleSheetsSection({ agentId }: { agentId: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [serviceEmail, setServiceEmail] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [link, setLink] = useState('')
  const [sheetName, setSheetName] = useState('Leads')
  const [enabled, setEnabled] = useState(true)
  const [onlyComplete, setOnlyComplete] = useState(true)
  const [busy, setBusy] = useState<null | 'save' | 'sync'>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    // Solo la primera carga muestra skeleton (estado inicial); recargar tras guardar es silencioso
    try {
      const base = backendBase()
      if (base) {
        const info = await fetch(`${base}/api/integrations/google-sheets/info`).then(r => r.json()).catch(() => null)
        if (info) { setServiceEmail(info.serviceAccountEmail ?? null); setConfigured(!!info.configured) }
      }
      const { data } = await supabase
        .from('agent_integrations')
        .select('id,enabled,only_complete,spreadsheet_id,sheet_name,last_sync_at,last_error')
        .eq('agent_id', agentId)
        .eq('provider', 'google_sheets')
        .maybeSingle()
      if (data) {
        setIntegration(data as Integration)
        setLink(`https://docs.google.com/spreadsheets/d/${data.spreadsheet_id}/edit`)
        setSheetName(data.sheet_name)
        setEnabled(data.enabled)
        setOnlyComplete(data.only_complete !== false)
      }
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { void load() }, [load])

  const saveAndTest = async () => {
    const id = parseSpreadsheetId(link)
    if (!id) { setMessage({ ok: false, text: 'El enlace no parece de una hoja de Google Sheets.' }); return }
    if (!sheetName.trim()) { setMessage({ ok: false, text: 'Escribe el nombre de la pestaña.' }); return }
    setBusy('save'); setMessage(null)
    try {
      const { error } = await supabase.from('agent_integrations').upsert(
        { agent_id: agentId, provider: 'google_sheets', spreadsheet_id: id, sheet_name: sheetName.trim(), enabled, only_complete: onlyComplete, updated_at: new Date().toISOString() },
        { onConflict: 'agent_id,provider' },
      )
      if (error) throw new Error(error.message)
      const res = await callBackend('test', agentId)
      setMessage(res.ok
        ? { ok: true, text: 'Conexión lista: escribimos los encabezados en tu hoja. Desde ahora cada dato nuevo llega solo.' }
        : { ok: false, text: res.error ?? 'No se pudo conectar' })
      await load()
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const syncAll = async () => {
    setBusy('sync'); setMessage(null)
    try {
      const res = await callBackend('sync-all', agentId)
      setMessage(res.ok
        ? { ok: true, text: `Listo: se escribieron ${res.rows ?? 0} contactos en la hoja.` }
        : { ok: false, text: res.error ?? 'No se pudo sincronizar' })
      await load()
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const copyEmail = async () => {
    if (!serviceEmail) return
    try { await navigator.clipboard.writeText(serviceEmail); toast({ title: 'Correo copiado' }) } catch { /* sin portapapeles */ }
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Cada vez que el agente guarda datos de una persona, se escriben en tu hoja de Google Sheets: una fila por
        contacto y una columna por cada dato definido en <strong>Datos a recoger</strong>.
      </p>

      {!configured && (
        <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          <span>La conexión con Google todavía no está activada en el servidor. Pídele al administrador de la plataforma que la configure.</span>
        </div>
      )}

      <ol className="flex flex-col gap-4 text-sm">
        <li className="flex flex-col gap-2">
          <span><strong>1.</strong> Crea una hoja en Google Sheets (o usa una existente).</span>
        </li>
        <li className="flex flex-col gap-2">
          <span><strong>2.</strong> Compártela como <strong>Editor</strong> con este correo:</span>
          <div className="flex items-center gap-2">
            <Input readOnly value={serviceEmail ?? 'No disponible'} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyEmail} disabled={!serviceEmail} aria-label="Copiar correo">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </li>
        <li className="flex flex-col gap-2">
          <span><strong>3.</strong> Pega el enlace de la hoja y elige la pestaña donde se escribirá:</span>
          <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Pestaña</Label>
            <Input value={sheetName} onChange={e => setSheetName(e.target.value)} className="max-w-[200px]" />
            <span className="text-xs text-muted-foreground">Si no existe, se crea.</span>
          </div>
        </li>
        <li className="flex items-center gap-2">
          <Switch id="sheets-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="sheets-enabled" className="text-sm">Enviar los datos a esta hoja</Label>
        </li>
        <li className="flex items-start gap-2">
          <Switch id="sheets-only-complete" checked={onlyComplete} onCheckedChange={setOnlyComplete} className="mt-0.5" />
          <Label htmlFor="sheets-only-complete" className="text-sm leading-snug">
            Solo contactos con los datos completos (etapa «Listo para closer»)
            <span className="block text-xs text-muted-foreground">
              Recomendado para la hoja del closer. Las conversaciones en curso se ven en el Excel de seguimiento.
            </span>
          </Label>
        </li>
      </ol>

      <div className="flex flex-wrap gap-3">
        <Button onClick={saveAndTest} disabled={busy !== null || !configured} className="gap-2">
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar y probar conexión
        </Button>
        {integration && (
          <>
            <Button variant="outline" onClick={syncAll} disabled={busy !== null || !configured} className="gap-2">
              {busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Enviar todos los contactos actuales
            </Button>
            <Button variant="ghost" asChild className="gap-2">
              <a href={`https://docs.google.com/spreadsheets/d/${integration.spreadsheet_id}/edit`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Abrir hoja
              </a>
            </Button>
          </>
        )}
      </div>

      {message && (
        <p className={`flex items-start gap-2 text-sm ${message.ok ? 'text-emerald-500' : 'text-destructive'}`}>
          {message.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          {message.text}
        </p>
      )}

      {integration && (
        <div className="text-xs text-muted-foreground flex flex-col gap-1">
          <span>
            Última sincronización:{' '}
            {integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString('es-CO') : 'todavía ninguna'}
          </span>
          {integration.last_error && <span className="text-destructive">Último error: {integration.last_error}</span>}
          <span>"Enviar todos los contactos actuales" reescribe la pestaña completa; no escribas datos a mano en esas columnas.</span>
        </div>
      )}
    </div>
  )
}
