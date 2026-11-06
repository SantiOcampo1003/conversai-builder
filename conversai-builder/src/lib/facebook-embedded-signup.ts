/**
 * "Conectar con Facebook": Embedded Signup de WhatsApp (popup de Meta).
 * El popup devuelve un `code` (vale 30 s, una sola vez) y, por `postMessage`, los IDs del número y de la cuenta.
 * Si el cliente ya había autorizado la app y pulsa "Continuar", Meta no envía los IDs: el backend los descubre con el token.
 * El backend cambia el code por el token del cliente; el navegador nunca ve ese token.
 */

const GRAPH_VERSION = 'v25.0'
const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js'
/** Tiempo para que llegue el mensaje con los IDs después del code (pueden llegar en cualquier orden); si no llega, sigue sin ellos. */
const IDS_TIMEOUT_MS = 10_000

interface FacebookSdk {
  init(params: { appId: string; version: string; xfbml: boolean; autoLogAppEvents?: boolean }): void
  login(callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void, options: Record<string, unknown>): void
}

declare global {
  interface Window {
    FB?: FacebookSdk
    fbAsyncInit?: () => void
  }
}

export interface EmbeddedSignupResult {
  code: string
  /** null si Meta no los envió (el backend los descubre). */
  phoneNumberId: string | null
  wabaId: string | null
}

export const embeddedSignupConfig = () => {
  const appId = import.meta.env.VITE_META_APP_ID as string | undefined
  const configId = import.meta.env.VITE_META_ES_CONFIG_ID as string | undefined
  return appId && configId ? { appId, configId } : null
}

let sdkPromise: Promise<FacebookSdk> | null = null

/** Carga el SDK de JS de Facebook solo cuando se usa (una vez por página). */
function loadSdk(appId: string): Promise<FacebookSdk> {
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, version: GRAPH_VERSION, xfbml: false, autoLogAppEvents: true })
      resolve(window.FB!)
    }
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onerror = () => {
      sdkPromise = null
      reject(new Error('No se pudo cargar Facebook. Revisa tu conexión o desactiva el bloqueador de anuncios.'))
    }
    document.body.appendChild(script)
  })
  return sdkPromise
}

const isFacebookOrigin = (origin: string) => {
  try {
    const { protocol, hostname } = new URL(origin)
    return protocol === 'https:' && (hostname === 'facebook.com' || hostname.endsWith('.facebook.com'))
  } catch {
    return false
  }
}

const FINISH_EVENTS = new Set(['FINISH', 'FINISH_ONLY_WABA', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'])

/** Abre el popup de Meta y espera el code y, si llegan, los IDs del número conectado. */
export async function launchEmbeddedSignup(): Promise<EmbeddedSignupResult> {
  const config = embeddedSignupConfig()
  if (!config) throw new Error('La conexión con Facebook no está configurada')
  const FB = await loadSdk(config.appId)

  return new Promise<EmbeddedSignupResult>((resolve, reject) => {
    let code: string | null = null
    let ids: { phoneNumberId: string | null; wabaId: string | null } | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (error?: Error) => {
      window.removeEventListener('message', onMessage)
      clearTimeout(timer)
      if (error) reject(error)
      else resolve({ code: code!, ...ids! })
    }
    const tryFinish = () => {
      if (code && ids) finish()
    }

    const onMessage = (event: MessageEvent) => {
      if (!isFacebookOrigin(event.origin)) return
      let payload: { type?: string; event?: string; data?: Record<string, string> }
      try {
        payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
      } catch {
        return
      }
      if (payload?.type !== 'WA_EMBEDDED_SIGNUP') return

      if (payload.event && FINISH_EVENTS.has(payload.event)) {
        const phoneNumberId = payload.data?.phone_number_id
        const wabaId = payload.data?.waba_id
        ids = phoneNumberId && wabaId ? { phoneNumberId: String(phoneNumberId), wabaId: String(wabaId) } : { phoneNumberId: null, wabaId: null }
        tryFinish()
      } else if (payload.event === 'CANCEL') {
        finish(new Error('Cerraste la ventana de Facebook antes de terminar.'))
      } else if (payload.event === 'ERROR') {
        finish(new Error(payload.data?.error_message || 'Facebook reportó un error al conectar el número.'))
      }
    }
    window.addEventListener('message', onMessage)

    FB.login(
      (response) => {
        const received = response.authResponse?.code
        if (!received) return finish(new Error('No se completó la conexión con Facebook.'))
        code = received
        if (ids) return tryFinish()
        timer = setTimeout(() => {
          ids = { phoneNumberId: null, wabaId: null }
          finish()
        }, IDS_TIMEOUT_MS)
      },
      {
        config_id: config.configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: '3' },
      },
    )
  })
}
