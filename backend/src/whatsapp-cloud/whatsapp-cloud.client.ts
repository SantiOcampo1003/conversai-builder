import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboundFile } from '../common/types/agent.types';

const DEFAULT_GRAPH_VERSION = 'v25.0';

/** Tope de los audios de WhatsApp (16 MB); también queda bajo el límite de 25 MB de la transcripción. */
export const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

export interface DownloadedMedia {
  data: Buffer;
  mimeType: string;
}

/**
 * Token con el que se llama a Graph: el de negocio del cliente (líneas de Embedded Signup) o, si no se pasa,
 * el de la plataforma (WHATSAPP_ACCESS_TOKEN; número de prueba y líneas conectadas por el super admin).
 */
export type AccessToken = string | null | undefined;

/** Envío de mensajes por la Cloud API oficial de WhatsApp (Graph API de Meta). */
@Injectable()
export class WhatsAppCloudClient {
  constructor(private readonly config: ConfigService) {}

  sendText(phoneNumberId: string, to: string, body: string, token?: AccessToken): Promise<void> {
    return this.send(phoneNumberId, { to, type: 'text', text: { body, preview_url: false } }, token);
  }

  /** Imagen o documento por URL pública (los archivos del agente ya viven en Storage público). */
  sendFile(phoneNumberId: string, to: string, file: OutboundFile, token?: AccessToken): Promise<void> {
    if (file.type === 'image') {
      return this.send(phoneNumberId, { to, type: 'image', image: { link: file.url, ...(file.caption && { caption: file.caption }) } }, token);
    }
    return this.send(
      phoneNumberId,
      {
        to,
        type: 'document',
        document: { link: file.url, ...(file.fileName && { filename: file.fileName }), ...(file.caption && { caption: file.caption }) },
      },
      token,
    );
  }

  /** Marca el mensaje como leído y muestra "escribiendo…" mientras el agente responde (hasta 25 s). Errores ignorados. */
  async markReadAndTyping(phoneNumberId: string, messageId: string, token?: AccessToken): Promise<void> {
    await this.request(
      'POST',
      `${encodeURIComponent(phoneNumberId)}/messages`,
      { messaging_product: 'whatsapp', status: 'read', message_id: messageId, typing_indicator: { type: 'text' } },
      token,
    ).catch(() => undefined);
  }

  /** Datos del número; falla si no existe o el token no tiene acceso a su cuenta. */
  async getPhoneNumber(phoneNumberId: string, token?: AccessToken): Promise<{ displayPhoneNumber: string; verifiedName: string | null }> {
    const data = await this.request('GET', `${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, undefined, token);
    return { displayPhoneNumber: data.display_phone_number, verifiedName: data.verified_name ?? null };
  }

  /** Suscribe esta app a los webhooks de la cuenta de WhatsApp Business (necesario para recibir sus mensajes). */
  async subscribeApp(wabaId: string, token?: AccessToken): Promise<void> {
    await this.request('POST', `${encodeURIComponent(wabaId)}/subscribed_apps`, undefined, token);
  }

  /**
   * Embedded Signup: cambia el `code` que devuelve el popup de Facebook por el token de negocio del cliente.
   * El code dura 30 s y sirve una sola vez.
   */
  async exchangeCode(code: string): Promise<string> {
    const appId = this.config.get<string>('META_APP_ID');
    const appSecret = this.config.get<string>('META_APP_SECRET');
    if (!appId || !appSecret) throw new Error('Falta configurar META_APP_ID o META_APP_SECRET en el servidor');
    const query = new URLSearchParams({ client_id: appId, client_secret: appSecret, code });
    const data = await this.request('GET', `oauth/access_token?${query.toString()}`, undefined, null);
    if (!data?.access_token) throw new BadGatewayException('WhatsApp (Meta) no devolvió el token de la cuenta');
    return data.access_token;
  }

  /** Registra el número en la Cloud API con un PIN de verificación en dos pasos (lo fija si el número no tenía). */
  async registerPhoneNumber(phoneNumberId: string, pin: string, token?: AccessToken): Promise<void> {
    await this.request('POST', `${encodeURIComponent(phoneNumberId)}/register`, { messaging_product: 'whatsapp', pin }, token);
  }

  /**
   * Descarga un archivo recibido (audio, imagen…): GET /{media_id} da una URL temporal (5 min)
   * que también exige el token.
   */
  async downloadMedia(mediaId: string, token?: AccessToken): Promise<DownloadedMedia> {
    const info = await this.request('GET', encodeURIComponent(mediaId), undefined, token);
    if (!info?.url) throw new BadGatewayException('WhatsApp (Meta) no devolvió la URL del archivo');
    if (Number(info.file_size) > MAX_MEDIA_BYTES) throw new Error(`Archivo demasiado grande (${info.file_size} bytes)`);

    const res = await fetch(info.url, { headers: { Authorization: `Bearer ${this.token(token)}` }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new BadGatewayException(`WhatsApp (Meta) respondió ${res.status} al descargar el archivo`);
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > MAX_MEDIA_BYTES) throw new Error(`Archivo demasiado grande (${data.length} bytes)`);
    return { data, mimeType: String(info.mime_type ?? res.headers.get('content-type') ?? '') };
  }

  private async send(phoneNumberId: string, message: Record<string, unknown>, token: AccessToken): Promise<void> {
    await this.request(
      'POST',
      `${encodeURIComponent(phoneNumberId)}/messages`,
      { messaging_product: 'whatsapp', recipient_type: 'individual', ...message },
      token,
    );
  }

  /** El token de la línea o, si no tiene, el de la plataforma. */
  private token(token: AccessToken): string {
    if (token) return token;
    const platform = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    if (!platform) throw new Error('Falta configurar WHATSAPP_ACCESS_TOKEN en el servidor');
    return platform;
  }

  /** `token === null`: llamada sin token (intercambio del code de Embedded Signup). */
  private async request(method: 'GET' | 'POST', path: string, body: Record<string, unknown> | undefined, token: AccessToken): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token !== null) headers.Authorization = `Bearer ${this.token(token)}`;
    const version = this.config.get<string>('META_GRAPH_VERSION') || DEFAULT_GRAPH_VERSION;
    // Solo para pruebas locales contra un servidor simulado; en producción no se define
    const base = (this.config.get<string>('META_GRAPH_BASE_URL') || 'https://graph.facebook.com').replace(/\/$/, '');

    const res = await fetch(`${base}/${version}/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    if (res.ok) return text ? JSON.parse(text) : null;
    let detail = text.slice(0, 200);
    try {
      const error = JSON.parse(text)?.error;
      if (error?.message) detail = error.code ? `(#${error.code}) ${error.message}` : error.message;
    } catch {
      /* respuesta no JSON */
    }
    throw new BadGatewayException(`WhatsApp (Meta) respondió ${res.status}: ${detail}`);
  }
}
