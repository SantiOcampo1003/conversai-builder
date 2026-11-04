import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { readDataFields } from '@/lib/data-fields'
import { DEFAULT_TEMPLATE, LogRow, RecipientRow, normalizePhone } from '@/lib/notifications'

const backendBase = () => (import.meta.env.VITE_BACKEND_CHAT_URL as string | undefined)?.replace(/\/$/, '')

interface Props {
  agent: { agent_id: string; business_name: string; required_info: string[] | null; data_fields?: unknown }
}

export function NotificationsSection({ agent }: Props) {
  const { toast } = useToast()
  const fields = readDataFields(agent)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [sendingPending, setSendingPending] = useState(false)
  const [notificationId, setNotificationId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [routeField, setRouteField] = useState<string>('')
  const [recipients, setRecipients] = useState<RecipientRow[]>([])
  const [log, setLog] = useState<LogRow[]>([])
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: n } = await supabase
        .from('agent_notifications')
        .select('id,enabled,message_template,route_field')
        .eq('agent_id', agent.agent_id)
        .eq('trigger', 'lead_complete')
        .maybeSingle()
      if (n) {
        setNotificationId(n.id)
        setEnabled(n.enabled)
        setTemplate(n.message_template)
        setRouteField(n.route_field ?? '')
        const { data: rs } = await supabase
          .from('agent_notification_recipients')
          .select('id,match_value,phone,label,enabled')
          .eq('notification_id', n.id)
          .order('created_at')
        setRecipients((rs ?? []).map(r => ({ id: r.id, match_value: r.match_value ?? '', phone: r.phone, label: r.label ?? '', enabled: r.enabled })))
      }
      const { data: lg } = await supabase
        .from('notification_log')
        .select('id,customer_id,recipient_phone,recipient_label,status,error,is_test,created_at')
        .eq('agent_id', agent.agent_id)
        .order('created_at', { ascending: false })
        .limit(15)
      setLog((lg ?? []) as LogRow[])
    } finally {
      setLoading(false)
    }
  }, [agent.agent_id])

  useEffect(() => { void load() }, [load])

  const update = (i: number, patch: Partial<RecipientRow>) =>
    setRecipients(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const insertVariable = (name: string) => {
    const token = `{{${name}}}`
    const el = textRef.current
    if (!el) { setTemplate(t => `${t}${token}`); return }
    const start = el.selectionStart ?? template.length
    const end = el.selectionEnd ?? template.length
    setTemplate(template.slice(0, start) + token + template.slice(end))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length) })
  }

  const save = async () => {
    setMessage(null)
    if (!template.trim()) { setMessage({ ok: false, text: 'Escribe el mensaje que se enviará.' }); return }
    for (const r of recipients) {
      if (!normalizePhone(r.phone)) { setMessage({ ok: false, text: `El número "${r.phone}" no es válido. Escríbelo completo, ej. 3001234567.` }); return }
    }
    setSaving(true)
    try {
      const { data: n, error } = await supabase
        .from('agent_notifications')
        .upsert(
          { agent_id: agent.agent_id, trigger: 'lead_complete', enabled, message_template: template, route_field: routeField || null, updated_at: new Date().toISOString() },
          { onConflict: 'agent_id,trigger' },
        )
        .select('id')
        .single()
      if (error || !n) throw new Error(error?.message ?? 'No se pudo guardar')
      // Se reemplaza la lista completa de destinatarios
      const del = await supabase.from('agent_notification_recipients').delete().eq('notification_id', n.id)
      if (del.error) throw new Error(del.error.message)
      if (recipients.length > 0) {
        const ins = await supabase.from('agent_notification_recipients').insert(
          recipients.map(r => ({
            notification_id: n.id,
            match_value: r.match_value.trim() === '' || r.match_value.trim() === '*' ? null : r.match_value.trim(),
            phone: normalizePhone(r.phone)!,
            label: r.label.trim() || null,
            enabled: r.enabled,
          })),
        )
        if (ins.error) throw new Error(ins.error.message)
      }
      setMessage({ ok: true, text: 'Guardado. El aviso se enviará cuando un contacto quede con todos los datos obligatorios.' })
      await load()
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const sendTest = async (phone: string) => {
    const base = backendBase()
    setTesting(phone)
    try {
      if (!base) throw new Error('Falta configurar VITE_BACKEND_CHAT_URL')
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Vuelve a iniciar sesión')
      const res = await fetch(`${base}/api/notifications/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agentId: agent.agent_id, phone }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`)
      toast(json.ok
        ? { title: 'Mensaje de prueba enviado', description: 'Revisa el WhatsApp de ese número.' }
        : { title: 'No se pudo enviar', description: json.error ?? 'Error desconocido', variant: 'destructive' })
      await load()
    } catch (e) {
      toast({ title: 'No se pudo enviar', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setTesting(null)
    }
  }

  const sendPending = async () => {
    const base = backendBase()
    setSendingPending(true)
    try {
      if (!base) throw new Error('Falta configurar VITE_BACKEND_CHAT_URL')
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Vuelve a iniciar sesión')
      const res = await fetch(`${base}/api/notifications/send-pending`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ agentId: agent.agent_id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`)
      toast({
        title: `Avisos enviados: ${json.sent}`,
        description: json.failed ? `${json.failed} no se pudieron enviar (revisa el registro de abajo).` : 'Los contactos completos que faltaban ya se avisaron.',
        variant: json.failed ? 'destructive' : undefined,
      })
      await load()
    } catch (e) {
      toast({ title: 'No se pudo enviar', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSendingPending(false)
    }
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  const routeLabel = fields.find(f => f.key === routeField)?.label

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Cuando un contacto queda con <strong>todos los datos obligatorios</strong> (etapa «Listo para closer»), enviamos un
        WhatsApp a las personas que elijas, desde la misma línea del agente. Se avisa <strong>una sola vez</strong> por contacto.
      </p>

      <div className="flex items-center gap-2">
        <Switch id="notif-enabled" checked={enabled} onCheckedChange={setEnabled} />
        <Label htmlFor="notif-enabled" className="text-sm">Enviar avisos</Label>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Mensaje</Label>
        <Textarea ref={textRef} value={template} onChange={e => setTemplate(e.target.value)} rows={7} className="font-mono text-sm" />
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center">Insertar:</span>
          {['resumen', 'whatsapp_link', 'telefono', ...fields.map(f => f.key)].map(v => (
            <button key={v} type="button" onClick={() => insertVariable(v)}
              className="px-2 py-0.5 rounded-md text-xs border border-border text-muted-foreground hover:border-primary/40">
              {`{{${v}}}`}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          <code>{'{{resumen}}'}</code> lista todos los datos recogidos. <code>{'{{whatsapp_link}}'}</code> y <code>{'{{telefono}}'}</code> salen
          vacíos si WhatsApp no entrega el número real de la persona (por privacidad): por eso el agente le pide que escriba su teléfono.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>¿A quién se avisa?</Label>
        <select
          value={routeField}
          onChange={e => setRouteField(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm max-w-md"
        >
          <option value="">A todos los destinatarios de la lista</option>
          {fields.map(f => <option key={f.key} value={f.key}>Según «{f.label}»</option>)}
        </select>
        {routeField && (
          <p className="text-xs text-muted-foreground">
            En cada destinatario escribe el valor exacto de «{routeLabel}» para el que aplica (ej. <em>CLAN Atelier</em>).
            Si lo dejas vacío o pones <code>*</code>, recibe los contactos que no coincidan con nadie (respaldo).
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Label>Destinatarios</Label>
        {recipients.length === 0 && (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">Todavía no hay destinatarios.</p>
        )}
        {recipients.map((r, i) => (
          <div key={r.id ?? i} className="rounded-lg border p-3 flex flex-wrap items-center gap-2">
            {routeField && (
              <Input value={r.match_value} onChange={e => update(i, { match_value: e.target.value })}
                placeholder={`Si «${routeLabel}» es…`} className="w-48" />
            )}
            <Input value={r.label} onChange={e => update(i, { label: e.target.value })} placeholder="Nombre (ej. Laura)" className="w-40" />
            <Input value={r.phone} onChange={e => update(i, { phone: e.target.value })} placeholder="Celular (ej. 3001234567)" className="w-48" />
            <div className="flex items-center gap-1.5">
              <Switch checked={r.enabled} onCheckedChange={v => update(i, { enabled: v })} />
              <span className="text-xs text-muted-foreground">Activo</span>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={!r.id || testing !== null} onClick={() => sendTest(r.phone)}
              title={r.id ? 'Enviar un mensaje de prueba a este número' : 'Guarda primero para poder probar'}>
              {testing === r.phone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Probar
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setRecipients(prev => prev.filter((_, idx) => idx !== i))} aria-label="Quitar">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-2 self-start"
          onClick={() => setRecipients(prev => [...prev, { match_value: '', phone: '', label: '', enabled: true }])}>
          <Plus className="h-4 w-4" /> Agregar destinatario
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </Button>
        <Button variant="outline" onClick={sendPending} disabled={sendingPending || !notificationId} className="gap-2"
          title="Envía el aviso de los contactos que ya están completos y todavía no se avisaron">
          {sendingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar avisos pendientes
        </Button>
        {message && (
          <span className={`flex items-center gap-1.5 text-sm ${message.ok ? 'text-emerald-500' : 'text-destructive'}`}>
            {message.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Los avisos incluyen datos personales (por ejemplo, de menores). Agrega solo números de personas autorizadas a verlos.
      </p>

      {log.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>Últimos avisos</Label>
          <div className="rounded-lg border divide-y text-sm">
            {log.map(l => (
              <div key={l.id} className="px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {l.status === 'sent'
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  : <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                <span>{l.recipient_label ? `${l.recipient_label} · ` : ''}{l.recipient_phone}</span>
                <span className="text-muted-foreground">{l.is_test ? 'prueba' : l.customer_id}</span>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(l.created_at).toLocaleString('es-CO')}</span>
                {l.error && <span className="w-full text-xs text-destructive pl-7">{l.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
