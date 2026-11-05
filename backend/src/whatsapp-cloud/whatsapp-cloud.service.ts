import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatService } from '../chat/chat.service';
import { DatabaseService } from '../database/database.service';
import { AudioTranscriber } from './audio-transcriber';
import { decryptToken } from './token-crypto';
import { extractInboundMessages, InboundMessage } from './webhook-payload';
import { AccessToken, WhatsAppCloudClient } from './whatsapp-cloud.client';

export const UNSUPPORTED_MESSAGE = 'Por ahora solo puedo leer mensajes de texto y notas de voz. ¿Me lo escribes, por favor? 🙏';
export const AUDIO_FAILED_MESSAGE = 'No pude escuchar bien tu nota de voz. ¿Me la escribes, por favor? 🙏';

/** Tipos que no merecen respuesta (no son un mensaje del cliente). */
const SILENT_TYPES = new Set(['reaction', 'unsupported', 'system', 'ephemeral', 'request_welcome']);

interface MetaLine {
  agent_id: string | null;
  meta_access_token_encrypted: string | null;
}

/** Cuántos IDs de mensaje recordar para no responder dos veces a un reintento de Meta. */
const SEEN_LIMIT = 2000;

/** Mensajes entrantes de la API oficial: los pasa al mismo agente que atiende las líneas por QR. */
@Injectable()
export class WhatsAppCloudService {
  private readonly logger = new Logger(WhatsAppCloudService.name);
  private readonly seen = new Set<string>();

  constructor(
    private readonly db: DatabaseService,
    private readonly chat: ChatService,
    private readonly client: WhatsAppCloudClient,
    private readonly transcriber: AudioTranscriber,
    private readonly config: ConfigService,
  ) {}

  async handleWebhook(payload: unknown): Promise<void> {
    for (const message of extractInboundMessages(payload)) {
      if (this.alreadySeen(message.messageId)) continue;
      try {
        await this.reply(message);
      } catch (e) {
        this.logger.error(`No se pudo responder ${message.messageId} de la línea ${message.phoneNumberId}: ${(e as Error).message}`);
      }
    }
  }

  private async reply(message: InboundMessage): Promise<void> {
    const { phoneNumberId, from } = message;
    if (SILENT_TYPES.has(message.type)) return;

    const line = await this.lineOf(phoneNumberId);
    if (!line?.agent_id) {
      this.logger.warn(`Mensaje para la línea ${phoneNumberId} sin línea registrada o sin agente asignado`);
      return;
    }
    const agentId = line.agent_id;
    const token = this.tokenOf(line);

    await this.client.markReadAndTyping(phoneNumberId, message.messageId, token);
    let messageText = message.text;
    if (messageText === null && message.mediaId) {
      messageText = await this.transcribe(message, token);
      if (!messageText) {
        await this.client.sendText(phoneNumberId, from, AUDIO_FAILED_MESSAGE, token);
        return;
      }
    }
    if (messageText === null) {
      await this.client.sendText(phoneNumberId, from, UNSUPPORTED_MESSAGE, token);
      return;
    }

    const { output, files } = await this.chat.handleMessage({ agentId, userId: from, messageText });
    if (output?.trim()) await this.client.sendText(phoneNumberId, from, output.trim(), token);
    for (const file of files ?? []) {
      await this.client
        .sendFile(phoneNumberId, from, file, token)
        .catch((e) => this.logger.warn(`No se pudo enviar el archivo ${file.assetKey}: ${(e as Error).message}`));
    }
  }

  /** Texto de la nota de voz; '' si no se pudo descargar o transcribir (el error queda en el log). */
  private async transcribe(message: InboundMessage, token: AccessToken): Promise<string> {
    try {
      const { data, mimeType } = await this.client.downloadMedia(message.mediaId!, token);
      return await this.transcriber.transcribe(data, mimeType);
    } catch (e) {
      this.logger.warn(`No se pudo transcribir el audio ${message.messageId}: ${(e as Error).message}`);
      return '';
    }
  }

  private async lineOf(phoneNumberId: string): Promise<MetaLine | null> {
    const { data } = await this.db
      .getAdminClient()
      .from('whatsapp_lines')
      .select('agent_id, meta_access_token_encrypted')
      .eq('provider', 'meta_cloud')
      .eq('meta_phone_number_id', phoneNumberId)
      .maybeSingle();
    return (data as MetaLine | null) ?? null;
  }

  /** Token de negocio del cliente (Embedded Signup) o undefined para usar el de la plataforma. */
  private tokenOf(line: MetaLine): AccessToken {
    if (!line.meta_access_token_encrypted) return undefined;
    return decryptToken(line.meta_access_token_encrypted, this.config.get<string>('WHATSAPP_TOKEN_ENCRYPTION_KEY'));
  }

  /** Meta reintenta el webhook hasta por 7 días: se responde una sola vez por mensaje. */
  private alreadySeen(messageId: string): boolean {
    if (this.seen.has(messageId)) return true;
    this.seen.add(messageId);
    if (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value as string);
    return false;
  }
}
