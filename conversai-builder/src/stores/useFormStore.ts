import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Product {
  id: string
  name: string
  price: string
}

export interface FAQ {
  id: string
  question: string
  answer: string
}

export interface CustomInstruction {
  id: string
  text: string
}

interface FormState {
  // Navegación
  currentStep: number

  // Paso 1 - Negocio
  businessName: string
  businessType: string
  businessCategory: string
  priceFrom: string
  priceTo: string
  currency: string

  // Paso 2 - Productos
  products: Product[]

  // Paso 3 - Envío y pago
  offersDelivery: boolean
  deliveryCost: string
  deliveryTime: string
  paymentMethods: string[]
  paymentGateway: string
  paymentLinks: Record<string, string>

  // Paso 4 - FAQ
  faqs: FAQ[]
  commonObjection: string
  objectionResponse: string

  // Paso 5 - Personalidad
  tone: string
  useEmojis: boolean
  formalityLevel: string

  // Paso 6 - Cierre
  requiredInfo: string[]
  warranty: string
  email: string
  customInstructions: CustomInstruction[]
}

interface FormActions {
  setCurrentStep: (step: number) => void

  // Negocio
  setBusinessName: (v: string) => void
  setBusinessType: (v: string) => void
  setBusinessCategory: (v: string) => void
  setPriceFrom: (v: string) => void
  setPriceTo: (v: string) => void
  setCurrency: (v: string) => void

  // Productos
  setProducts: (v: Product[]) => void
  addProduct: () => void
  removeProduct: (id: string) => void
  updateProduct: (id: string, field: keyof Product, value: string) => void

  // Envío y pago
  setOffersDelivery: (v: boolean) => void
  setDeliveryCost: (v: string) => void
  setDeliveryTime: (v: string) => void
  setPaymentMethods: (v: string[]) => void
  setPaymentGateway: (v: string) => void
  setPaymentLinks: (v: Record<string, string>) => void

  // FAQ
  setFaqs: (v: FAQ[]) => void
  addFaq: () => void
  removeFaq: (id: string) => void
  updateFaq: (id: string, field: keyof FAQ, value: string) => void
  setCommonObjection: (v: string) => void
  setObjectionResponse: (v: string) => void

  // Personalidad
  setTone: (v: string) => void
  setUseEmojis: (v: boolean) => void
  setFormalityLevel: (v: string) => void

  // Cierre
  setRequiredInfo: (v: string[]) => void
  setWarranty: (v: string) => void
  setEmail: (v: string) => void
  setCustomInstructions: (v: CustomInstruction[]) => void
  addInstruction: () => void
  removeInstruction: (id: string) => void
  updateInstruction: (id: string, text: string) => void

  // Reset completo al terminar
  resetForm: () => void
}

const initialState: FormState = {
  currentStep: 1,
  businessName: '',
  businessType: 'products',
  businessCategory: '',
  priceFrom: '',
  priceTo: '',
  currency: 'COP',
  products: [{ id: '1', name: '', price: '' }],
  offersDelivery: false,
  deliveryCost: '',
  deliveryTime: '',
  paymentMethods: [],
  paymentGateway: 'none',
  paymentLinks: {},
  faqs: [{ id: '1', question: '', answer: '' }],
  commonObjection: '',
  objectionResponse: '',
  tone: 'friendly',
  useEmojis: true,
  formalityLevel: 'tu',
  requiredInfo: [],
  warranty: '',
  email: '',
  customInstructions: [{ id: '1', text: '' }],
}

export const useFormStore = create<FormState & FormActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentStep: (step) => set({ currentStep: step }),

      // Negocio
      setBusinessName: (v) => set({ businessName: v }),
      setBusinessType: (v) => set({ businessType: v }),
      setBusinessCategory: (v) => set({ businessCategory: v }),
      setPriceFrom: (v) => set({ priceFrom: v }),
      setPriceTo: (v) => set({ priceTo: v }),
      setCurrency: (v) => set({ currency: v }),

      // Productos
      setProducts: (v) => set({ products: v }),
      addProduct: () => {
        const products = get().products
        set({ products: [...products, { id: Date.now().toString(), name: '', price: '' }] })
      },
      removeProduct: (id) => {
        const products = get().products
        if (products.length > 1) set({ products: products.filter(p => p.id !== id) })
      },
      updateProduct: (id, field, value) => {
        set({ products: get().products.map(p => p.id === id ? { ...p, [field]: value } : p) })
      },

      // Envío y pago
      setOffersDelivery: (v) => set({ offersDelivery: v }),
      setDeliveryCost: (v) => set({ deliveryCost: v }),
      setDeliveryTime: (v) => set({ deliveryTime: v }),
      setPaymentMethods: (v) => set({ paymentMethods: v }),
      setPaymentGateway: (v) => set({ paymentGateway: v }),
      setPaymentLinks: (v) => set({ paymentLinks: v }),

      // FAQ
      setFaqs: (v) => set({ faqs: v }),
      addFaq: () => {
        const faqs = get().faqs
        set({ faqs: [...faqs, { id: Date.now().toString(), question: '', answer: '' }] })
      },
      removeFaq: (id) => {
        const faqs = get().faqs
        if (faqs.length > 1) set({ faqs: faqs.filter(f => f.id !== id) })
      },
      updateFaq: (id, field, value) => {
        set({ faqs: get().faqs.map(f => f.id === id ? { ...f, [field]: value } : f) })
      },
      setCommonObjection: (v) => set({ commonObjection: v }),
      setObjectionResponse: (v) => set({ objectionResponse: v }),

      // Personalidad
      setTone: (v) => set({ tone: v }),
      setUseEmojis: (v) => set({ useEmojis: v }),
      setFormalityLevel: (v) => set({ formalityLevel: v }),

      // Cierre
      setRequiredInfo: (v) => set({ requiredInfo: v }),
      setWarranty: (v) => set({ warranty: v }),
      setEmail: (v) => set({ email: v }),
      setCustomInstructions: (v) => set({ customInstructions: v }),
      addInstruction: () => {
        const instructions = get().customInstructions
        set({ customInstructions: [...instructions, { id: Date.now().toString(), text: '' }] })
      },
      removeInstruction: (id) => {
        const instructions = get().customInstructions
        if (instructions.length > 1) set({ customInstructions: instructions.filter(i => i.id !== id) })
      },
      updateInstruction: (id, text) => {
        set({ customInstructions: get().customInstructions.map(i => i.id === id ? { ...i, text } : i) })
      },

      resetForm: () => set(initialState),
    }),
    {
      name: 'easy-agents-form', // clave en localStorage
    }
  )
)
