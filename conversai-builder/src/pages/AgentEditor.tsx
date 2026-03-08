import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useClientContext } from '@/hooks/use-client-context'
import { useIsSuperAdmin } from '@/hooks/use-is-super-admin'
import { useEditorStore } from '@/stores/useEditorStore'
import { supabase } from '@/lib/supabase'
import {
  Store, DollarSign, Truck, MessageCircle, Sparkles, CheckCircle2,
  ChevronLeft, Loader2, Save, Plus, Trash2, Check, Target, Key, Settings,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Agent {
  id: number
  agent_id: string
  business_name: string
  business_type: string | null
  business_category: string | null
  price_range: { from: string; to: string; currency: string } | null
  products: { name: string; price: string }[] | null
  delivery: { offers: boolean; cost: string; time: string } | null
  payment_methods: string[] | null
  payment_gateway: string | null
  payment_links: Record<string, string> | null
  faqs: { question: string; answer: string }[] | null
  objection_handling: { common: string; response: string } | null
  agent_personality: { tone: string; useEmojis: boolean; formalityLevel: string } | null
  required_info: string[] | null
  warranty: string | null
  custom_instructions: { instruction: string; active: boolean }[] | null
  internal_custom_instructions: string | null
  email: string | null
}

interface MetaAdsConfig {
  is_enabled: boolean
  pixel_id: string
  access_token: string
  test_mode: boolean
  test_event_code: string
  tracked_events: {
    event: string
    enabled: boolean
    max_per_user: number
    description: string
  }[]
}

type SectionId = 'business' | 'products' | 'payments' | 'faqs' | 'personality' | 'advanced' | 'meta-ads'

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'business',     label: 'Negocio',          icon: Store,         description: 'Nombre, tipo y categoría' },
  { id: 'products',     label: 'Productos',         icon: DollarSign,    description: 'Catálogo de productos' },
  { id: 'payments',     label: 'Pagos y entrega',   icon: Truck,         description: 'Métodos y envíos' },
  { id: 'faqs',         label: 'FAQs',              icon: MessageCircle, description: 'Preguntas frecuentes' },
  { id: 'personality',  label: 'Personalidad',      icon: Sparkles,      description: 'Tono y estilo' },
  { id: 'advanced',     label: 'Avanzado',          icon: CheckCircle2,  description: 'Info requerida y más' },
  { id: 'meta-ads',     label: 'Meta Ads',          icon: Target,        description: 'Configuración de tracking' },
]

const BUSINESS_CATEGORIES = [
  { value: 'Ropa y Moda',             label: 'Ropa y Moda' },
  { value: 'Tecnología',              label: 'Tecnología' },
  { value: 'Alimentos y Bebidas',     label: 'Alimentos y Bebidas' },
  { value: 'Belleza',                 label: 'Belleza' },
  { value: 'Hogar y Decoración',      label: 'Hogar y Decoración' },
  { value: 'Servicios Profesionales', label: 'Servicios Profesionales' },
  { value: 'Salud y Bienestar',       label: 'Salud y Bienestar' },
  { value: 'Educación',               label: 'Educación' },
  { value: 'Educación Financiera',    label: 'Educación Financiera' },
  { value: 'Otro',                    label: 'Otro' },
]

const PAYMENT_METHOD_OPTIONS = ['efectivo', 'transferencia', 'tarjeta', 'nequi', 'daviplata', 'pse', 'paypal', 'otro']
const REQUIRED_INFO_OPTIONS  = ['nombre', 'telefono', 'email', 'direccion', 'ciudad']

// ── Save toast ─────────────────────────────────────────────────────────────────
function SaveToast({ show, error }: { show: boolean; error: string | null }) {
  if (!show) return null
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all',
      error
        ? 'bg-destructive text-destructive-foreground'
        : 'bg-primary text-primary-foreground'
    )}>
      {error ? error : <><Check className="h-4 w-4" /> Cambios guardados</>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AgentEditor() {
  const { agentId } = useParams<{ agentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { clientId, isLoading: loadingClientId } = useClientContext()
  const { isSuperAdmin } = useIsSuperAdmin()
  const { hasUnsavedChanges, markAsSaved, reset: resetEditorStore } = useEditorStore()

  const [agent, setAgent]           = useState<Agent | null>(null)
  const [loading, setLoading]       = useState(true)
  const [activeSection, setActiveSection] = useState<SectionId>('business')
  const [saving, setSaving]         = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastError, setToastError] = useState<string | null>(null)
  const [showExitDialog, setShowExitDialog] = useState(false)

  // ── Load agent ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !agentId || !clientId || loadingClientId) return
    const load = async () => {
      setLoading(true)

      const { data } = await supabase
        .from('agents')
        .select('*')
        .eq('agent_id', agentId)
        .eq('client_id', clientId)
        .single()

      setAgent(data || null)
      setLoading(false)
      resetEditorStore() // Limpiar flag al cargar nuevo agente
    }
    load()
  }, [user, agentId, clientId, loadingClientId, resetEditorStore])

  // ── Save helper ───────────────────────────────────────────────────────────────
  const save = async (patch: Partial<Agent>) => {
    if (!agent) return
    setSaving(true)
    setToastError(null)
    const { error } = await supabase
      .from('agents')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('agent_id', agent.agent_id)

    setSaving(false)
    setToastError(error ? error.message : null)
    setToastVisible(true)
    if (!error) {
      setAgent(prev => prev ? { ...prev, ...patch } : prev)
      markAsSaved() // Limpiar flag de cambios
    }
    setTimeout(() => setToastVisible(false), 3000)
  }

  // ── Detectar cambios sin guardar ──────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = '' // Chrome requiere esto
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // ── Loading / not found ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Agente no encontrado o sin permisos.</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          Volver al dashboard
        </Button>
      </div>
    )
  }

  const activeItem = SECTIONS.find(s => s.id === activeSection)!

  // Handler para volver al dashboard con confirmación si hay cambios
  const handleBackToDashboard = () => {
    if (hasUnsavedChanges) {
      setShowExitDialog(true)
    } else {
      navigate('/dashboard')
    }
  }

  const confirmExit = () => {
    setShowExitDialog(false)
    navigate('/dashboard')
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-4 px-6 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToDashboard}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Button>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{agent.business_name}</span>
          <span className="text-xs text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded">
            {agent.agent_id}
          </span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col py-4 gap-1 px-2 overflow-hidden">
          {SECTIONS.map(({ id, label, icon: Icon, description }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-all w-full group',
                activeSection === id
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className={cn(
                'h-4 w-4 shrink-0 mt-0.5',
                activeSection === id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )} />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none">{label}</p>
                <p className="text-[10px] mt-0.5 opacity-60 truncate">{description}</p>
              </div>
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto pb-8">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-foreground">{activeItem.label}</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{activeItem.description}</p>
            </div>

            {activeSection === 'business'    && <BusinessSection    agent={agent} onSave={save} saving={saving} />}
            {activeSection === 'products'    && <ProductsSection    agent={agent} onSave={save} saving={saving} />}
            {activeSection === 'payments'    && <PaymentsSection    agent={agent} onSave={save} saving={saving} />}
            {activeSection === 'faqs'        && <FaqsSection        agent={agent} onSave={save} saving={saving} />}
            {activeSection === 'personality' && <PersonalitySection agent={agent} onSave={save} saving={saving} />}
            {activeSection === 'advanced'    && <AdvancedSection    agent={agent} onSave={save} saving={saving} isSuperAdmin={isSuperAdmin} />}
            {activeSection === 'meta-ads'    && <MetaAdsSection     agent={agent} onSave={save} saving={saving} isSuperAdmin={isSuperAdmin} />}
          </div>
        </main>
      </div>

      <SaveToast show={toastVisible} error={toastError} />

      {/* Dialog de confirmación al salir con cambios sin guardar */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar. Si sales ahora, se perderán todos los cambios realizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Salir sin guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ── Shared save button ─────────────────────────────────────────────────────────
function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <Button
      onClick={onClick}
      disabled={saving}
      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 mt-6"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      Guardar cambios
    </Button>
  )
}

// ── Section: Negocio ──────────────────────────────────────────────────────────
function BusinessSection({ agent, onSave, saving }: { agent: Agent; onSave: (p: Partial<Agent>) => void; saving: boolean }) {
  const markAsUnsaved = useEditorStore(state => state.markAsUnsaved)

  const [name, setName]         = useState(agent.business_name || '')
  const [type, setType]         = useState(agent.business_type || 'Productos físicos')
  const [category, setCategory] = useState(agent.business_category || '')
  const [priceFrom, setPriceFrom] = useState(agent.price_range?.from || '')
  const [priceTo, setPriceTo]   = useState(agent.price_range?.to || '')
  const [currency, setCurrency] = useState(agent.price_range?.currency || 'COP')

  const handleChange = <T,>(setter: (val: T) => void) => (val: T) => {
    setter(val)
    markAsUnsaved()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label>Nombre del negocio</Label>
        <Input value={name} onChange={e => handleChange(setName)(e.target.value)} placeholder="Ej: Mi Tienda" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Tipo de negocio</Label>
        <Select value={type} onValueChange={handleChange(setType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {type && !['Productos físicos', 'Productos digitales', 'Servicios', 'Ambos'].includes(type) && (
              <SelectItem value={type}>{type} (personalizado)</SelectItem>
            )}
            <SelectItem value="Productos físicos">Productos físicos</SelectItem>
            <SelectItem value="Productos digitales">Productos digitales</SelectItem>
            <SelectItem value="Servicios">Servicios</SelectItem>
            <SelectItem value="Ambos">Ambos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Categoría</Label>
        <Select value={category} onValueChange={handleChange(setCategory)}>
          <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
          <SelectContent>
            {/* Si el valor actual no está en la lista, agregarlo */}
            {category && !BUSINESS_CATEGORIES.find(c => c.value === category) && (
              <SelectItem value={category}>{category} (personalizado)</SelectItem>
            )}
            {BUSINESS_CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Rango de precios</Label>
        <div className="flex gap-3 items-center">
          <Select value={currency} onValueChange={handleChange(setCurrency)}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COP">COP</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
            </SelectContent>
          </Select>
          <Input value={priceFrom} onChange={e => handleChange(setPriceFrom)(e.target.value)} placeholder="Desde" className="flex-1" />
          <span className="text-muted-foreground text-sm">–</span>
          <Input value={priceTo} onChange={e => handleChange(setPriceTo)(e.target.value)} placeholder="Hasta" className="flex-1" />
        </div>
      </div>

      <SaveButton
        saving={saving}
        onClick={() => onSave({
          business_name: name,
          business_type: type,
          business_category: category,
          price_range: { from: priceFrom, to: priceTo, currency },
        })}
      />
    </div>
  )
}

// ── Section: Productos ────────────────────────────────────────────────────────
function ProductsSection({ agent, onSave, saving }: { agent: Agent; onSave: (p: Partial<Agent>) => void; saving: boolean }) {
  const markAsUnsaved = useEditorStore(state => state.markAsUnsaved)
  const [items, setItems] = useState<{ name: string; price: string }[]>(
    Array.isArray(agent.products) ? agent.products : []
  )

  const add = () => setItems(prev => [...prev, { name: '', price: '' }])
  const remove = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const update = (i: number, field: 'name' | 'price', val: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay productos. Agrega el primero.</p>
      )}

      {items.map((item, i) => (
        <div key={i} className="flex gap-3 items-start bg-secondary/30 rounded-xl p-3 border border-border">
          <div className="flex-1 flex gap-2">
            <Input
              value={item.name}
              onChange={e => update(i, 'name', e.target.value)}
              placeholder="Nombre del producto"
              className="flex-1"
            />
            <Input
              value={item.price}
              onChange={e => update(i, 'price', e.target.value)}
              placeholder="Precio"
              className="w-28"
            />
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive h-9 w-9 p-0 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará "{item.name || 'este producto'}" de la lista. Deberás guardar los cambios para que se aplique.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => remove(i)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={add} className="gap-2 self-start">
        <Plus className="h-4 w-4" /> Agregar producto
      </Button>

      <SaveButton saving={saving} onClick={() => onSave({ products: items })} />
    </div>
  )
}

// ── Section: Pagos y entrega ──────────────────────────────────────────────────
function PaymentsSection({ agent, onSave, saving }: { agent: Agent; onSave: (p: Partial<Agent>) => void; saving: boolean }) {
  const markAsUnsaved = useEditorStore(state => state.markAsUnsaved)
  const [methods, setMethods]       = useState<string[]>(Array.isArray(agent.payment_methods) ? agent.payment_methods : [])
  const [offersDelivery, setOffers] = useState(agent.delivery?.offers ?? false)
  const [deliveryCost, setCost]     = useState(agent.delivery?.cost || '')
  const [deliveryTime, setTime]     = useState(agent.delivery?.time || '')
  const [gateway, setGateway]       = useState(agent.payment_gateway || 'none')
  const [links, setLinks]           = useState<Record<string, string>>(agent.payment_links || {})

  const toggleMethod = (m: string) =>
    setMethods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const productNames = (agent.products || []).map(p => p.name).filter(Boolean)

  return (
    <div className="flex flex-col gap-5">
      {/* Payment methods */}
      <div className="flex flex-col gap-2">
        <Label>Métodos de pago</Label>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHOD_OPTIONS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => toggleMethod(m)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm border transition-all capitalize',
                methods.includes(m)
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'bg-secondary/50 text-muted-foreground border-border hover:border-primary/30'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="offers-delivery"
            checked={offersDelivery}
            onCheckedChange={v => setOffers(!!v)}
          />
          <Label htmlFor="offers-delivery">Ofrece domicilio / envío</Label>
        </div>
        {offersDelivery && (
          <div className="flex gap-3 pl-6">
            <div className="flex flex-col gap-1.5 flex-1">
              <Label className="text-xs">Costo de envío</Label>
              <Input value={deliveryCost} onChange={e => setCost(e.target.value)} placeholder="Ej: 5000" />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label className="text-xs">Tiempo de entrega</Label>
              <Input value={deliveryTime} onChange={e => setTime(e.target.value)} placeholder="Ej: 2-3 días" />
            </div>
          </div>
        )}
      </div>

      {/* Gateway */}
      <div className="flex flex-col gap-1.5">
        <Label>Pasarela de pago</Label>
        <Select value={gateway} onValueChange={setGateway}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Ninguna</SelectItem>
            <SelectItem value="hotmart">Hotmart</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
            <SelectItem value="mercadopago">MercadoPago</SelectItem>
            <SelectItem value="paypal">PayPal</SelectItem>
            <SelectItem value="other">Otra</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payment links per product */}
      {gateway !== 'none' && productNames.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label>Links de pago por producto</Label>
          {productNames.map(name => (
            <div key={name} className="flex gap-3 items-center">
              <span className="text-sm text-muted-foreground w-32 truncate shrink-0">{name}</span>
              <Input
                value={links[name] || ''}
                onChange={e => setLinks(prev => ({ ...prev, [name]: e.target.value }))}
                placeholder="https://..."
                className="flex-1"
              />
            </div>
          ))}
        </div>
      )}

      <SaveButton
        saving={saving}
        onClick={() => onSave({
          payment_methods: methods,
          delivery: { offers: offersDelivery, cost: deliveryCost, time: deliveryTime },
          payment_gateway: gateway,
          payment_links: links,
        })}
      />
    </div>
  )
}

// ── Section: FAQs ─────────────────────────────────────────────────────────────
function FaqsSection({ agent, onSave, saving }: { agent: Agent; onSave: (p: Partial<Agent>) => void; saving: boolean }) {
  const markAsUnsaved = useEditorStore(state => state.markAsUnsaved)
  const [faqs, setFaqs]   = useState<{ question: string; answer: string }[]>(Array.isArray(agent.faqs) ? agent.faqs : [])
  const [objCommon, setObjCommon]     = useState(agent.objection_handling?.common || '')
  const [objResponse, setObjResponse] = useState(agent.objection_handling?.response || '')

  const addFaq    = () => setFaqs(prev => [...prev, { question: '', answer: '' }])
  const removeFaq = (i: number) => setFaqs(prev => prev.filter((_, idx) => idx !== i))
  const updateFaq = (i: number, field: 'question' | 'answer', val: string) =>
    setFaqs(prev => prev.map((faq, idx) => idx === i ? { ...faq, [field]: val } : faq))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Label>Preguntas frecuentes</Label>
        {faqs.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay FAQs. Agrega la primera.</p>
        )}
        {faqs.map((faq, i) => (
          <div key={i} className="flex flex-col gap-2 bg-secondary/30 rounded-xl p-3 border border-border">
            <div className="flex gap-2 items-start">
              <div className="flex-1 flex flex-col gap-2">
                <Input
                  value={faq.question}
                  onChange={e => updateFaq(i, 'question', e.target.value)}
                  placeholder="Pregunta"
                />
                <Textarea
                  value={faq.answer}
                  onChange={e => updateFaq(i, 'answer', e.target.value)}
                  placeholder="Respuesta"
                  rows={2}
                  className="resize-none"
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive h-9 w-9 p-0 shrink-0 mt-0.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar FAQ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará esta pregunta frecuente. Deberás guardar los cambios para que se aplique.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeFaq(i)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addFaq} className="gap-2 self-start">
          <Plus className="h-4 w-4" /> Agregar FAQ
        </Button>
      </div>

      <div className="border-t border-border pt-5 flex flex-col gap-3">
        <Label>Manejo de objeciones</Label>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Objeción más común</Label>
          <Input value={objCommon} onChange={e => setObjCommon(e.target.value)} placeholder="Ej: Es muy caro" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Respuesta del agente</Label>
          <Textarea value={objResponse} onChange={e => setObjResponse(e.target.value)} placeholder="Ej: Entiendo tu preocupación..." rows={3} className="resize-none" />
        </div>
      </div>

      <SaveButton
        saving={saving}
        onClick={() => onSave({
          faqs,
          objection_handling: { common: objCommon, response: objResponse },
        })}
      />
    </div>
  )
}

// ── Section: Personalidad ─────────────────────────────────────────────────────
function PersonalitySection({ agent, onSave, saving }: { agent: Agent; onSave: (p: Partial<Agent>) => void; saving: boolean }) {
  const markAsUnsaved = useEditorStore(state => state.markAsUnsaved)
  const [tone, setTone]           = useState(agent.agent_personality?.tone || 'friendly')
  const [useEmojis, setUseEmojis] = useState(agent.agent_personality?.useEmojis ?? true)
  const [formality, setFormality] = useState(agent.agent_personality?.formalityLevel || 'tu')

  const tones = [
    { value: 'formal',   label: 'Formal',    desc: 'Profesional y serio' },
    { value: 'friendly', label: 'Amigable',  desc: 'Cercano y cálido' },
    { value: 'casual',   label: 'Casual',    desc: 'Relajado e informal' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Tono del agente</Label>
        <div className="grid grid-cols-3 gap-3">
          {tones.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTone(t.value)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl p-3 border text-left transition-all',
                tone === t.value
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-secondary/30 border-border text-muted-foreground hover:border-primary/30'
              )}
            >
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-[10px] opacity-70">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Tratamiento al cliente</Label>
        <div className="flex gap-3">
          {[{ value: 'tu', label: 'Tuteo (tú)' }, { value: 'usted', label: 'Usted' }].map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormality(f.value)}
              className={cn(
                'flex-1 rounded-xl p-3 border text-sm font-medium transition-all',
                formality === f.value
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'bg-secondary/30 border-border text-muted-foreground hover:border-primary/30'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-secondary/30 rounded-xl p-4 border border-border">
        <Checkbox
          id="use-emojis"
          checked={useEmojis}
          onCheckedChange={v => setUseEmojis(!!v)}
        />
        <div>
          <Label htmlFor="use-emojis" className="cursor-pointer">Usar emojis en las respuestas</Label>
          <p className="text-xs text-muted-foreground mt-0.5">El agente añadirá emojis para hacer las respuestas más expresivas</p>
        </div>
      </div>

      <SaveButton
        saving={saving}
        onClick={() => onSave({
          agent_personality: { tone, useEmojis, formalityLevel: formality },
        })}
      />
    </div>
  )
}

// ── Section: Avanzado ─────────────────────────────────────────────────────────
function AdvancedSection({ agent, onSave, saving, isSuperAdmin }: { agent: Agent; onSave: (p: Partial<Agent>) => void; saving: boolean; isSuperAdmin: boolean }) {
  const markAsUnsaved = useEditorStore(state => state.markAsUnsaved)
  const [reqInfo, setReqInfo]     = useState<string[]>(Array.isArray(agent.required_info) ? agent.required_info : [])
  const [warranty, setWarranty]   = useState(agent.warranty || '')
  const [instructions, setInstr]  = useState<{ instruction: string; active: boolean }[]>(
    Array.isArray(agent.custom_instructions) ? agent.custom_instructions : []
  )
  const [internalInstructions, setInternalInstr] = useState(agent.internal_custom_instructions || '')

  const toggleInfo = (v: string) =>
    setReqInfo(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])

  const addInstr    = () => setInstr(prev => [...prev, { instruction: '', active: true }])
  const removeInstr = (i: number) => setInstr(prev => prev.filter((_, idx) => idx !== i))
  const updateInstr = (i: number, val: string) =>
    setInstr(prev => prev.map((ins, idx) => idx === i ? { ...ins, instruction: val } : ins))
  const toggleActive = (i: number) =>
    setInstr(prev => prev.map((ins, idx) => idx === i ? { ...ins, active: !ins.active } : ins))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label>Información requerida al cliente</Label>
        <p className="text-xs text-muted-foreground">El agente solicitará estos datos durante la conversación</p>
        <div className="flex flex-wrap gap-2">
          {REQUIRED_INFO_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => toggleInfo(opt)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm border transition-all capitalize',
                reqInfo.includes(opt)
                  ? 'bg-primary/15 text-primary border-primary/40'
                  : 'bg-secondary/50 text-muted-foreground border-border hover:border-primary/30'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Política de garantía</Label>
        <Textarea
          value={warranty}
          onChange={e => setWarranty(e.target.value)}
          placeholder="Ej: 30 días de garantía de satisfacción..."
          rows={3}
          className="resize-none"
        />
      </div>

      {isSuperAdmin && (
        <div className="flex flex-col gap-1.5 p-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Label className="text-amber-900 dark:text-amber-100">Instrucciones Internas del Sistema</Label>
            <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
              Solo Super Admin
            </span>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Reglas internas que siempre se aplican (restricciones de chat, formato, etc.)
          </p>
          <Textarea
            value={internalInstructions}
            onChange={e => setInternalInstr(e.target.value)}
            placeholder="Reglas internas del sistema..."
            rows={8}
            className="resize-none font-mono text-sm"
          />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Label>Instrucciones personalizadas</Label>
        <p className="text-xs text-muted-foreground">Reglas o comportamientos específicos para el agente. Activa o desactiva cada instrucción según necesites.</p>
        {instructions.map((ins, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex items-start pt-1">
              <Checkbox
                checked={ins.active}
                onCheckedChange={() => toggleActive(i)}
                className="mt-2"
              />
            </div>
            <div className="flex-1">
              <Textarea
                value={ins.instruction}
                onChange={e => updateInstr(i, e.target.value)}
                placeholder="Ej: Nunca menciones a la competencia..."
                rows={2}
                className={cn(
                  "resize-none",
                  !ins.active && "opacity-50"
                )}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {ins.active ? 'Activa' : 'Inactiva'} • El agente {ins.active ? 'usará' : 'no usará'} esta instrucción
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive h-9 w-9 p-0 shrink-0 mt-0.5"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar instrucción?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminará esta instrucción personalizada. Deberás guardar los cambios para que se aplique.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => removeInstr(i)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addInstr} className="gap-2 self-start">
          <Plus className="h-4 w-4" /> Agregar instrucción
        </Button>
      </div>

      <SaveButton
        saving={saving}
        onClick={() => onSave({
          required_info: reqInfo,
          warranty,
          custom_instructions: instructions,
          ...(isSuperAdmin ? { internal_custom_instructions: internalInstructions } : {}),
        })}
      />
    </div>
  )
}

// ── Meta Ads Section ──────────────────────────────────────────────────────────
function MetaAdsSection({ agent, onSave, saving, isSuperAdmin }: { agent: Agent; onSave: (p: Partial<Agent>) => void; saving: boolean; isSuperAdmin: boolean }) {
  const markAsUnsaved = useEditorStore(state => state.markAsUnsaved)
  // Cargar configuracion desde meta_ads_config
  const [loading, setLoading] = useState(true)
  const [metaConfig, setMetaConfig] = useState<MetaAdsConfig | null>(null)

  // Estados locales
  const [isEnabled, setIsEnabled] = useState(false)
  const [pixelId, setPixelId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [testMode, setTestMode] = useState(true)
  const [testEventCode, setTestEventCode] = useState('')
  const [trackedEvents, setTrackedEvents] = useState([
    { event: 'Contact', enabled: true, max_per_user: 1, description: 'Primera interacción del usuario' },
    { event: 'Lead', enabled: true, max_per_user: 2, description: 'Usuario muestra interés comercial' },
    { event: 'SubmitApplication', enabled: false, max_per_user: 1, description: 'Usuario solicita avanzar con compra' },
    { event: 'HotmartLinkSent', enabled: true, max_per_user: 3, description: 'Se comparte enlace de Hotmart' },
  ])

  // Cargar configuracion solo UNA VEZ al montar (no recargar al cambiar de pestaña)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    // Si ya se cargó, NO volver a cargar (evita sobrescribir cambios del usuario)
    if (hasLoaded) return

    async function loadMetaConfig() {
      const { data, error } = await supabase
        .from('meta_ads_config')
        .select('*')
        .eq('agent_id', agent.agent_id)
        .maybeSingle()

      if (!error && data) {
        setMetaConfig(data)
        setIsEnabled(data.is_enabled || false)
        setPixelId(data.pixel_id || '')
        setTestMode(data.test_mode ?? true)
        setTestEventCode(data.test_event_code || '')
        if (data.tracked_events) {
          setTrackedEvents(data.tracked_events)
        }
      }
      setLoading(false)
      setHasLoaded(true) // Marcar como cargado
    }
    loadMetaConfig()
  }, [agent.agent_id, hasLoaded])

  const handleSave = async () => {
    try {
      const config: any = {
        agent_id: agent.agent_id,
        is_enabled: isEnabled,
        pixel_id: pixelId,
        test_mode: testMode,
        test_event_code: testEventCode || null,
        tracked_events: trackedEvents,
      }

      // Solo incluir access_token si el usuario escribió algo
      // Si está vacío y ya existe config, NO sobrescribir (mantener el existente)
      if (accessToken) {
        // Codificar token a Base64 antes de guardar
        config.access_token = btoa(accessToken)
      } else if (!metaConfig) {
        // Si es nuevo y está vacío, guardar null
        config.access_token = null
      }
      // Si es update y está vacío, NO incluir el campo (mantener el existente en BD)

      if (metaConfig) {
        // Update existing
        const { error } = await supabase
          .from('meta_ads_config')
          .update(config)
          .eq('agent_id', agent.agent_id)

        if (error) throw error
      } else {
        // Insert new
        const { error } = await supabase
          .from('meta_ads_config')
          .insert([config])

        if (error) throw error
      }

      // Trigger parent save callback for toast notification
      onSave({})
    } catch (error) {
      console.error('Error saving Meta Ads config:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header con toggle principal */}
      <div className="flex items-center gap-3 bg-secondary/30 rounded-xl p-4 border border-border">
        <Switch
          id="enable-meta-ads"
          checked={isEnabled}
          onCheckedChange={(val) => { setIsEnabled(val); markAsUnsaved(); }}
          disabled={!isSuperAdmin}
        />
        <div className="flex-1">
          <Label htmlFor="enable-meta-ads" className="cursor-pointer font-medium">
            Habilitar Meta Ads Tracking
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Envía eventos de conversión a Meta Business Manager para optimizar tus campañas publicitarias
          </p>
        </div>
        {isEnabled && (
          <Badge variant="default" className="bg-green-500">Activo</Badge>
        )}
      </div>

      {/* Campos de configuracion (solo si esta habilitado) */}
      {isEnabled && (
        <>
          {/* Credenciales */}
          <div className="border border-border rounded-xl p-4 space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              Credenciales de Meta
            </h3>

            <div className="flex flex-col gap-1.5">
              <Label>Pixel ID *</Label>
              <Input
                value={pixelId}
                onChange={(e) => { setPixelId(e.target.value); markAsUnsaved(); }}
                placeholder="1610790209771573"
                disabled={!isSuperAdmin}
              />
              <p className="text-xs text-muted-foreground">
                Lo encuentras en Events Manager → Configuración → Pixel
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Access Token *</Label>
              <Input
                type="password"
                value={accessToken}
                onChange={(e) => { setAccessToken(e.target.value); markAsUnsaved(); }}
                placeholder="Ingresa el access token"
                disabled={!isSuperAdmin}
              />
              <p className="text-xs text-muted-foreground">
                Genera uno desde Business Settings → System Users
              </p>
            </div>
          </div>

          {/* Test Mode */}
          <div className="border border-amber-500/30 rounded-xl p-4 bg-amber-50 dark:bg-amber-950/20 space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                id="test-mode"
                checked={testMode}
                onCheckedChange={(val) => { setTestMode(val); markAsUnsaved(); }}
                disabled={!isSuperAdmin}
              />
              <div className="flex-1">
                <Label htmlFor="test-mode" className="cursor-pointer font-medium text-amber-900 dark:text-amber-100">
                  Modo de Prueba
                </Label>
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Los eventos se enviarán a Test Events Tool (no se usan para optimización)
                </p>
              </div>
            </div>

            {testMode && (
              <div className="pl-6">
                <Label className="text-xs text-amber-900 dark:text-amber-100">Código de Evento de Prueba</Label>
                <Input
                  value={testEventCode}
                  onChange={(e) => { setTestEventCode(e.target.value); markAsUnsaved(); }}
                  placeholder="TEST53568"
                  disabled={!isSuperAdmin}
                  className="bg-white dark:bg-background"
                />
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-1">
                  Ve los eventos en tiempo real en Events Manager → Test Events
                </p>
              </div>
            )}
          </div>

          {/* Configuracion de eventos */}
          <div className="border border-border rounded-xl p-4 space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Configuración de Eventos
            </h3>
            <p className="text-sm text-muted-foreground">
              Configura qué eventos trackear y sus límites por usuario
            </p>

            <div className="space-y-3">
              {trackedEvents.map((evt, idx) => (
                <div
                  key={evt.event}
                  className={cn(
                    "border rounded-lg p-3 space-y-2",
                    evt.enabled ? "bg-primary/5 border-primary/30" : "bg-muted/50 border-border"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Switch
                        checked={evt.enabled}
                        onCheckedChange={(checked) => {
                          const newEvents = [...trackedEvents]
                          newEvents[idx].enabled = checked
                          setTrackedEvents(newEvents)
                          markAsUnsaved()
                        }}
                        disabled={!isSuperAdmin}
                      />
                      <div className="flex-1">
                        <Label className="font-medium">{evt.event}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {evt.description}
                        </p>
                      </div>
                    </div>
                    {evt.enabled && (
                      <Badge variant="default" className="text-xs">
                        Habilitado
                      </Badge>
                    )}
                  </div>

                  {evt.enabled && (
                    <div className="pl-9 pt-2 border-t border-border/50">
                      <Label className="text-xs">Máximo de eventos por usuario</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={evt.max_per_user}
                        onChange={(e) => {
                          const newEvents = [...trackedEvents]
                          newEvents[idx].max_per_user = parseInt(e.target.value) || 1
                          setTrackedEvents(newEvents)
                          markAsUnsaved()
                        }}
                        className="w-24 mt-1"
                        disabled={!isSuperAdmin}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Previene enviar eventos duplicados
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Save button (solo para super admin) */}
          {isSuperAdmin && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar Configuración
            </Button>
          )}

          {/* Read-only message para clientes */}
          {!isSuperAdmin && (
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Esta configuración es administrada por el equipo de soporte.
                <br />
                Contacta a tu administrador si necesitas hacer cambios.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
