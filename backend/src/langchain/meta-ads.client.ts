import { createHash } from 'crypto';
import axios, { AxiosError } from 'axios';

export interface MetaEventPayload {
  event_name: string;
  event_time: number; // Unix timestamp
  action_source: 'physical_store' | 'website' | 'app' | 'phone_call' | 'chat' | 'email' | 'other';
  user_data: {
    ph?: string[]; // Hashed phone number(s)
    em?: string[]; // Hashed email(s)
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string; // Facebook click ID
    fbp?: string; // Facebook browser ID
  };
  custom_data?: {
    source?: string;
    agent_id?: string;
    user_id?: string;
    currency?: string;
    value?: number;
    [key: string]: any;
  };
  event_id?: string; // For deduplication
  opt_out?: boolean;
}

export interface MetaEventResponse {
  events_received?: number;
  messages?: string[];
  fbtrace_id?: string;
}

export interface SendEventResult {
  success: boolean;
  eventId?: string;
  error?: string;
  details?: any;
}

/**
 * Cliente HTTP para Meta Conversions API
 *
 * Uso:
 * ```typescript
 * const client = new MetaAdsClient(pixelId, accessToken, testMode, testEventCode);
 * const result = await client.sendEvent(payload);
 * ```
 */
export class MetaAdsClient {
  private readonly apiVersion = 'v21.0';
  private readonly baseUrl = 'https://graph.facebook.com';

  constructor(
    private readonly pixelId: string,
    private readonly accessToken: string,
    private readonly testMode: boolean = false,
    private readonly testEventCode?: string,
  ) {
    if (!pixelId || !accessToken) {
      throw new Error('Meta Ads Client: pixelId and accessToken are required');
    }
  }

  /**
   * Envia un evento a Meta Conversions API
   *
   * @param payload - Datos del evento segun especificacion de Meta
   * @returns Resultado del envio con success flag y eventId o error
   */
  async sendEvent(payload: MetaEventPayload): Promise<SendEventResult> {
    try {
      const url = `${this.baseUrl}/${this.apiVersion}/${this.pixelId}/events`;

      const body: any = {
        data: [payload],
        access_token: this.accessToken,
      };

      // Agregar test_event_code si esta en modo test
      if (this.testMode && this.testEventCode) {
        body.test_event_code = this.testEventCode;
      }

      console.log(`📤 Sending event to Meta API:`);
      console.log(`   Event: ${payload.event_name}`);
      console.log(`   Test Mode: ${this.testMode}`);
      console.log(`   URL: ${url}`);

      const response = await axios.post<MetaEventResponse>(url, body, {
        timeout: 5000, // 5 segundos max
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`✅ Meta API Response:`, response.data);

      return {
        success: true,
        eventId: response.data.fbtrace_id,
        details: response.data,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error(`❌ Meta API Error:`, {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          message: axiosError.message,
        });

        return {
          success: false,
          error: axiosError.response?.data
            ? JSON.stringify(axiosError.response.data)
            : axiosError.message,
          details: axiosError.response?.data,
        };
      }

      console.error(`❌ Unexpected error sending to Meta:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Hashea un numero de telefono segun el estandar de Meta
   *
   * Requisitos:
   * - Solo numeros (sin +, espacios, guiones)
   * - Lowercase (el hash debe ser en minusculas)
   * - SHA256
   *
   * @param phone - Numero de telefono (ej: +573001234567 o 3001234567)
   * @returns Hash SHA256 en minusculas
   */
  hashPhone(phone: string): string {
    // Remover todo excepto numeros
    const cleaned = phone.replace(/\D/g, '');

    // Crear hash SHA256 en lowercase
    const hash = createHash('sha256').update(cleaned).digest('hex');

    return hash.toLowerCase();
  }

  /**
   * Hashea un email segun el estandar de Meta
   *
   * Requisitos:
   * - Trim whitespace
   * - Lowercase
   * - SHA256
   *
   * @param email - Email del usuario
   * @returns Hash SHA256 en minusculas
   */
  hashEmail(email: string): string {
    const normalized = email.trim().toLowerCase();
    const hash = createHash('sha256').update(normalized).digest('hex');
    return hash.toLowerCase();
  }

  /**
   * Construye un payload basico de evento
   *
   * @param eventName - Nombre del evento (Contact, Lead, etc.)
   * @param userId - ID del usuario (phone number)
   * @param customData - Datos personalizados adicionales
   * @returns Payload listo para enviar
   */
  buildEventPayload(
    eventName: string,
    userId: string,
    customData?: Record<string, any>
  ): MetaEventPayload {
    return {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000), // Unix timestamp
      action_source: 'chat', // Mas apropiado para conversaciones por WhatsApp
      user_data: {
        ph: [this.hashPhone(userId)],
      },
      custom_data: {
        source: 'easy_agents',
        user_id: userId,
        ...customData,
      },
      event_id: `${userId}_${eventName}_${Date.now()}`, // Para deduplicacion
    };
  }
}
