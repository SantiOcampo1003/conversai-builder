import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useClientContext } from '@/hooks/use-client-context'
import { useIsSuperAdmin } from '@/hooks/use-is-super-admin'
import { supabase } from '@/lib/supabase'
import {
  Store, DollarSign, Truck, MessageCircle, Sparkles, CheckCircle2,
  ChevronLeft, Loader2, Save, Plus, Trash2, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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

type SectionId = 'business' | 'products' | 'payments' | 'faqs' | 'personality' | 'advanced'

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'business',     label: 'Negocio',          icon: Store,         description: 'Nombre, tipo y categoría' },
  { id: 'products',     label: 'Productos',         icon: DollarSign,    description: 'Catálogo de productos' },
  { id: 'payments',     label: 'Pagos y entrega',   icon: Truck,         description: 'Métodos y envíos' },
  { id: 'faqs',         label: 'FAQs',              icon: MessageCircle, description: 'Preguntas frecuentes' },
  { id: 'personality',  label: 'Personalidad',      icon: Sparkles,      description: 'Tono y estilo' },
  { id: 'advanced',     label: 'Avanzado',          icon: CheckCircle2,  description: 'Info requerida y más' },
]

const BUSINESS_CATEGORIES = [
  { value: 'ropa',                   label: 'Ropa y Moda' },
  { value: 'tecnologia',             label: 'Tecnología' },
  { value: 'alimentos',              label: 'Alimentos y Bebidas' },
  { value: 'belleza',                label: 'Belleza y Cuidado Personal' },
  { value: 'hogar',                  label: 'Hogar y Decoración' },
  { value: 'servicios-profesionales',label: 'Servicios Profesionales' },
  { value: 'salud',                  label: 'Salud y Bienestar' },
  { value: 'educacion',              label: 'Educación' },
  { value: 'food',                   label: 'Alimentos (food)' },
  { value: 'restaurant',             label: 'Restaurante' },
  { value: 'otro',                   label: 'Otro' },
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

  const [agent, setAgent]           = useState<Agent | null>(null)
  const [loading, setLoading]       = useState(true)
  const [activeSection, setActiveSection] = useState<SectionId>('business')
  const [saving, setSaving]         = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastError, setToastError] = useState<string | null>(null)

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
    }
    load()
  }, [user, agentId, clientId, loadingClientId])

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
    if (!error) setAgent(prev => prev ? { ...prev, ...patch } : prev)
    setTimeout(() => setToastVisible(false), 3000)
  }

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top bar ── */}
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-4 px-6 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
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

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Fixed, no scroll */}
        <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col py-4 gap-1 px-2 h-full overflow-hidden">
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

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-8 h-full">
          <div className="max-w-2xl mx-auto">
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
          </div>
        </main>
      </div>

      <SaveToast show={toastVisible} error={toastError} />
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
  const [name, setName]         = useState(agent.business_name || '')
  const [type, setType]         = useState(agent.business_type || 'products')
  const [category, setCategory] = useState(agent.business_category || '')
  const [priceFrom, setPriceFrom] = useState(agent.price_range?.from || '')
  const [priceTo, setPriceTo]   = useState(agent.price_range?.to || '')
  const [currency, setCurrency] = useState(agent.price_range?.currency || 'COP')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label>Nombre del negocio</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Mi Tienda" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Tipo de negocio</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="products">Productos</SelectItem>
            <SelectItem value="services">Servicios</SelectItem>
            <SelectItem value="both">Productos y Servicios</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Categoría</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
          <SelectContent>
            {BUSINESS_CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Rango de precios</Label>
        <div className="flex gap-3 items-center">
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="COP">COP</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
            </SelectContent>
          </Select>
          <Input value={priceFrom} onChange={e => setPriceFrom(e.target.value)} placeholder="Desde" className="flex-1" />
          <span className="text-muted-foreground text-sm">–</span>
          <Input value={priceTo} onChange={e => setPriceTo(e.target.value)} placeholder="Hasta" className="flex-1" />
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
