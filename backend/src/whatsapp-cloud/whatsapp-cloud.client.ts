import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboundFile } from '../common/types/agent.types';

const DEFAULT_GRAPH_VERSION = 'v25.0';

/** Envío de mensajes por la Cloud API oficial de WhatsApp (Graph API de Meta). */
@Injectable()
export class WhatsAppCloudClient {
  constructor(private readonly config: ConfigService) {}

  sendText(phoneNumberId: string, to: string, body: string): Promise<void> {
    return this.send(phoneNumberId, { to, type: 'text', text: { body, preview_url: false } });
  }

  /** Imagen o documento por URL pública (los archivos del agente ya viven en Storage público). */
  sendFile(phoneNumberId: string, to: string, file: OutboundFile): Promise<void> {
    if (file.type === 'image') {
      return this.send(phoneNumberId, { to, type: 'image', image: { link: file.url, ...(file.caption && { caption: file.caption }) } });
    }
    return this.send(phoneNumberId, {
      to,
      type: 'document',
      document: { link: file.url, ...(file.fileName && { filename: file.fileName }), ...(file.caption && { caption: file.caption }) },
    });
  }

  /** Marca el mensaje como leído y muestra "escribiendo…" mientras el agente responde (hasta 25 s). Errores ignorados. */
  async markReadAndTyping(phoneNumberId: string, messageId: string): Promise<void> {
    await this.request('POST', `${encodeURIComponent(phoneNumberId)}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    }).catch(() => undefined);
  }

  /** Datos del número; falla si no existe o el token no tiene acceso a su cuenta. */
  async getPhoneNumber(phoneNumberId: string): Promise<{ displayPhoneNumber: string; verifiedName: string | null }> {
    const data = await this.request('GET', `${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`);
    return { displayPhoneNumber: data.display_phone_number, verifiedName: data.verified_name ?? null };
  }

  /** Suscribe esta app a los webhooks de la cuenta de WhatsApp Business (necesario para recibir sus mensajes). */
  async subscribeApp(wabaId: string): Promise<void> {
    await this.request('POST', `${encodeURIComponent(wabaId)}/subscribed_apps`);
  }

  private async send(phoneNumberId: string, message: Record<string, unknown>): Promise<void> {
    await this.request('POST', `${encodeURIComponent(phoneNumberId)}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...message,
    });
  }

  private async request(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<any> {
    // Piloto: un solo token (número de prueba). Con Embedded Signup cada línea tendrá su propio token cifrado.
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!token) throw new Error('Falta configurar WHATSAPP_ACCESS_TOKEN en el servidor');
    const version = this.config.get<string>('META_GRAPH_VERSION') || DEFAULT_GRAPH_VERSION;
    // Solo para pruebas locales contra un servidor simulado; en producción no se define
    const base = (this.config.get<string>('META_GRAPH_BASE_URL') || 'https://graph.facebook.com').replace(/\/$/, '');

    const res = await fetch(`${base}/${version}/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : null;
    let detail = text.slice(0, 200);
    try {
      detail = JSON.parse(text)?.error?.message ?? detail;
    } catch {
      /* respuesta no JSON */
    }
    throw new BadGatewayException(`WhatsApp (Meta) respondió ${res.status}: ${detail}`);
  }
}
