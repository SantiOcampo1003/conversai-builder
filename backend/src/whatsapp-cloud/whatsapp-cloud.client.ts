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

  /** Marca el mensaje como leído (doble check azul). Es cortesía: los errores se ignoran. */
  async markRead(phoneNumberId: string, messageId: string): Promise<void> {
    await this.post(phoneNumberId, { messaging_product: 'whatsapp', status: 'read', message_id: messageId }).catch(() => undefined);
  }

  private send(phoneNumberId: string, message: Record<string, unknown>): Promise<void> {
    return this.post(phoneNumberId, { messaging_product: 'whatsapp', recipient_type: 'individual', ...message });
  }

  private async post(phoneNumberId: string, body: Record<string, unknown>): Promise<void> {
    // Piloto: un solo token (número de prueba). Con Embedded Signup cada línea tendrá su propio token cifrado.
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!token) throw new Error('Falta configurar WHATSAPP_ACCESS_TOKEN en el servidor');
    const version = this.config.get<string>('META_GRAPH_VERSION') || DEFAULT_GRAPH_VERSION;
    // Solo para pruebas locales contra un servidor simulado; en producción no se define
    const base = (this.config.get<string>('META_GRAPH_BASE_URL') || 'https://graph.facebook.com').replace(/\/$/, '');

    const res = await fetch(`${base}/${version}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) return;
    const text = await res.text();
    let detail = text.slice(0, 200);
    try {
      detail = JSON.parse(text)?.error?.message ?? detail;
    } catch {
      /* respuesta no JSON */
    }
    throw new BadGatewayException(`WhatsApp (Meta) respondió ${res.status}: ${detail}`);
  }
}
