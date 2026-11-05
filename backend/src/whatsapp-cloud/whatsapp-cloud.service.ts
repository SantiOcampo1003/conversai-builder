import { Injectable, Logger } from '@nestjs/common';
import { ChatService } from '../chat/chat.service';
import { DatabaseService } from '../database/database.service';
import { extractInboundMessages, InboundMessage } from './webhook-payload';
import { WhatsAppCloudClient } from './whatsapp-cloud.client';

export const UNSUPPORTED_MESSAGE = 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor? 🙏';

/** Tipos que no merecen respuesta (no son un mensaje del cliente). */
const SILENT_TYPES = new Set(['reaction', 'unsupported', 'system', 'ephemeral', 'request_welcome']);

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

    const agentId = await this.agentOf(phoneNumberId);
    if (!agentId) {
      this.logger.warn(`Mensaje para la línea ${phoneNumberId} sin línea registrada o sin agente asignado`);
      return;
    }

    await this.client.markReadAndTyping(phoneNumberId, message.messageId);
    if (message.text === null) {
      await this.client.sendText(phoneNumberId, from, UNSUPPORTED_MESSAGE);
      return;
    }

    const { output, files } = await this.chat.handleMessage({ agentId, userId: from, messageText: message.text });
    if (output?.trim()) await this.client.sendText(phoneNumberId, from, output.trim());
    for (const file of files ?? []) {
      await this.client
        .sendFile(phoneNumberId, from, file)
        .catch((e) => this.logger.warn(`No se pudo enviar el archivo ${file.assetKey}: ${(e as Error).message}`));
    }
  }

  private async agentOf(phoneNumberId: string): Promise<string | null> {
    const { data } = await this.db
      .getAdminClient()
      .from('whatsapp_lines')
      .select('agent_id')
      .eq('provider', 'meta_cloud')
      .eq('meta_phone_number_id', phoneNumberId)
      .maybeSingle();
    return (data as { agent_id: string | null } | null)?.agent_id ?? null;
  }

  /** Meta reintenta el webhook hasta por 7 días: se responde una sola vez por mensaje. */
  private alreadySeen(messageId: string): boolean {
    if (this.seen.has(messageId)) return true;
    this.seen.add(messageId);
    if (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value as string);
    return false;
  }
}
