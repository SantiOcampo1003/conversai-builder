import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  MessageSquare,
  AlertCircle,
  Star,
  Lightbulb,
  HelpCircle,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type FeedbackType = 'bug' | 'feedback' | 'review' | 'feature_request' | 'other'
type FeedbackCategory = 'chat' | 'dashboard' | 'agents' | 'tokens' | 'whatsapp' | 'general' | 'other'

interface FeedbackDialogProps {
  trigger?: React.ReactNode
  defaultCategory?: FeedbackCategory
  metadata?: Record<string, any>
}

const typeIcons = {
  bug: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-500/10', label: 'Bug' },
  feedback: { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-500/10', label: 'Feedback' },
  review: { icon: Star, color: 'text-yellow-600', bg: 'bg-yellow-500/10', label: 'Review' },
  feature_request: { icon: Lightbulb, color: 'text-green-600', bg: 'bg-green-500/10', label: 'Mejora' },
  other: { icon: HelpCircle, color: 'text-gray-600', bg: 'bg-gray-500/10', label: 'Otro' },
}

const feedbackSchema = z.object({
  type: z.enum(['bug', 'feedback', 'review', 'feature_request', 'other']),
  category: z.enum(['chat', 'dashboard', 'agents', 'tokens', 'whatsapp', 'general', 'other']),
  rating: z.number().min(0).max(5),
  subject: z.string(),
  message: z.string(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
}).refine(
  (data) => {
    if (data.type === 'review') return true
    return data.subject.trim().length > 0
  },
  { message: 'El asunto es requerido', path: ['subject'] }
).refine(
  (data) => {
    if (data.type === 'review') return true
    return data.message.trim().length > 0
  },
  { message: 'El mensaje es requerido', path: ['message'] }
)

type FeedbackFormData = z.infer<typeof feedbackSchema>

export function FeedbackDialog({
  trigger,
  defaultCategory = 'general',
  metadata = {},
}: FeedbackDialogProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      type: 'feedback',
      category: defaultCategory,
      rating: 0,
      subject: '',
      message: '',
      email: user?.email || '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        type: 'feedback',
        category: defaultCategory,
        rating: 0,
        subject: '',
        message: '',
        email: user?.email || '',
      })
    }
  }, [open, defaultCategory, user?.email, form])

  const onSubmit = async (values: FeedbackFormData) => {
    try {
      const enrichedMetadata = {
        ...metadata,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }

      const { error } = await supabase.from('user_feedback').insert({
        user_id: user?.id || null,
        email: values.email || null,
        type: values.type,
        category: values.category,
        rating: values.rating > 0 ? values.rating : null,
        subject: values.subject || null,
        message: values.message || null,
        metadata: enrichedMetadata,
      })

      if (error) throw error

      setSubmitted(true)
      setTimeout(() => {
        setOpen(false)
        setTimeout(() => {
          form.reset()
          setSubmitted(false)
        }, 300)
      }, 2000)
    } catch (err) {
      console.error('Error submitting feedback:', err)
      alert('Error al enviar feedback. Por favor intenta de nuevo.')
    }
  }

  const currentType = form.watch('type')
  const TypeIcon = typeIcons[currentType].icon

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feedback
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground mb-1">
                ¡Gracias por tu feedback!
              </h3>
              <p className="text-sm text-muted-foreground">
                Tu opinión nos ayuda a mejorar la plataforma
              </p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enviar Feedback</DialogTitle>
              <DialogDescription>
                Cuéntanos sobre problemas, sugerencias o comparte tu experiencia
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de feedback</Label>
                <div className="grid grid-cols-5 gap-2">
                  {(Object.keys(typeIcons) as FeedbackType[]).map((type) => {
                    const Icon = typeIcons[type].icon
                    const isSelected = currentType === type
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => form.setValue('type', type)}
                        className={cn(
                          'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <Icon className={cn('h-5 w-5', typeIcons[type].color)} />
                        <span className="text-[10px] font-medium">
                          {typeIcons[type].label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={form.watch('category')}
                  onValueChange={(value) => form.setValue('category', value as FeedbackCategory)}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chat">Chat / Agente</SelectItem>
                    <SelectItem value="dashboard">Dashboard</SelectItem>
                    <SelectItem value="agents">Gestión de Agentes</SelectItem>
                    <SelectItem value="tokens">Tokens y Pagos</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentType === 'review' && (
                <div className="space-y-2">
                  <Label>Calificación</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => form.setValue('rating', star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={cn(
                            'h-8 w-8',
                            star <= form.watch('rating')
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!user && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    {...form.register('email')}
                  />
                  {form.formState.errors.email && (
                    <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Para poder contactarte si necesitamos más información
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="subject">
                  Asunto {currentType !== 'review' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="subject"
                  placeholder="Resume tu feedback en pocas palabras"
                  {...form.register('subject')}
                />
                {form.formState.errors.subject && (
                  <p className="text-xs text-red-600">{form.formState.errors.subject.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">
                  Mensaje {currentType !== 'review' && <span className="text-red-500">*</span>}
                </Label>
                <Textarea
                  id="message"
                  placeholder="Cuéntanos más detalles..."
                  rows={4}
                  {...form.register('message')}
                />
                {form.formState.errors.message && (
                  <p className="text-xs text-red-600">{form.formState.errors.message.message}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1"
                  disabled={form.formState.isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <TypeIcon className="h-4 w-4 mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
