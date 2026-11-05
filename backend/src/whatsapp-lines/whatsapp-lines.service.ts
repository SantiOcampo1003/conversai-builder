import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { EvolutionInstancesClient } from './evolution-instances.client';
import { extractQr, LineStatus, mapEvolutionState, phoneFromOwnerJid } from './line-state';

export interface WhatsAppLineRow {
  id: string;
  client_id: string;
  line_name: string;
  phone_number: string | null;
  agent_id: string | null;
  status: LineStatus;
  evolution_instance_name: string;
  qr_code: string | null;
  last_connected_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const NOT_FOUND_MESSAGE = 'La instancia ya no existe en WhatsApp. Elimina la línea y crea una nueva.';
export const SYNC_ERROR_MESSAGE = 'No se pudo consultar WhatsApp; se muestra el último estado guardado.';

/** Webhook del flujo v2 de n8n al que Evolution envía los mensajes de las líneas nuevas. */
const DEFAULT_WEBHOOK_URL = 'https://easy-agents-n8n.ftppdk.easypanel.host/webhook/whatsapp-incoming-generic-v2';

/** Líneas de WhatsApp: Evolution + tabla `whatsapp_lines`, con el estado real de cada instancia. */
@Injectable()
export class WhatsAppLinesService {
  private readonly logger = new Logger(WhatsAppLinesService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly evolution: EvolutionInstancesClient,
    private readonly config: ConfigService,
  ) {}

  /** Líneas del cliente con su estado sincronizado. Si Evolution falla se devuelve lo guardado. */
  async listAndSync(clientId: string): Promise<{ lines: WhatsAppLineRow[]; syncError: string | null }> {
    const { data, error } = await this.table()
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as WhatsAppLineRow[];
    const results = await Promise.allSettled(rows.map((row) => this.sync(row, false)));
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    failed.forEach((r) => this.logger.warn(`No se pudo sincronizar una línea: ${(r.reason as Error)?.message}`));

    return {
      lines: results.map((r, i) => (r.status === 'fulfilled' ? r.value : rows[i])),
      syncError: failed.length ? SYNC_ERROR_MESSAGE : null,
    };
  }

  /** Estado de una línea; si sigue esperando escaneo trae el QR vigente (Evolution lo cambia cada ~45 s). */
  async refresh(lineId: string): Promise<WhatsAppLineRow> {
    return this.sync(await this.get(lineId), true);
  }

  async create(clientId: string, lineName: string): Promise<WhatsAppLineRow> {
    const instanceName = `line_${Date.now()}_${Math.random().toString(36).slice(2, 11).padEnd(9, '0')}`;
    const webhook = this.config.get<string>('WHATSAPP_INCOMING_WEBHOOK_URL') || DEFAULT_WEBHOOK_URL;

    const created = await this.evolution.create(instanceName, webhook);
    const qr = extractQr(created) ?? extractQr(await this.evolution.connect(instanceName).catch(() => null));

    const { data, error } = await this.table()
      .insert({ client_id: clientId, line_name: lineName.trim(), evolution_instance_name: instanceName, status: 'pending', qr_code: qr })
      .select()
      .single();
    if (error) {
      // No dejar instancias huérfanas en Evolution (p. ej. límite de líneas alcanzado)
      await this.evolution.remove(instanceName).catch(() => undefined);
      throw new BadRequestException(error.message);
    }
    return data as WhatsAppLineRow;
  }

  async reconnect(lineId: string): Promise<WhatsAppLineRow> {
    const row = await this.get(lineId);
    const qr = extractQr(await this.evolution.connect(row.evolution_instance_name));
    return this.update(row.id, { qr_code: qr, status: 'pending', error_message: null });
  }

  async logout(lineId: string): Promise<WhatsAppLineRow> {
    const row = await this.get(lineId);
    await this.evolution.logout(row.evolution_instance_name);
    return this.update(row.id, { status: 'disconnected', phone_number: null, qr_code: null });
  }

  async remove(lineId: string): Promise<void> {
    const row = await this.get(lineId);
    await this.evolution.remove(row.evolution_instance_name);
    const { error } = await this.table().delete().eq('id', row.id);
    if (error) throw new BadRequestException(error.message);
  }

  async clientIdOf(lineId: string): Promise<string> {
    return (await this.get(lineId)).client_id;
  }

  /** Compara con Evolution y guarda solo si algo cambió. */
  private async sync(row: WhatsAppLineRow, renewQr: boolean): Promise<WhatsAppLineRow> {
    const name = row.evolution_instance_name;
    const status = mapEvolutionState(await this.evolution.connectionState(name), row.status);
    const patch: Partial<WhatsAppLineRow> = {};

    if (status !== row.status) patch.status = status;
    if (status === 'connected') {
      if (row.status !== 'connected') {
        patch.last_connected_at = new Date().toISOString();
        patch.qr_code = null;
      }
      if (row.status !== 'connected' || !row.phone_number) {
        const phone = phoneFromOwnerJid(await this.evolution.ownerJid(name).catch(() => null));
        if (phone && phone !== row.phone_number) patch.phone_number = phone;
      }
    }
    if (status === 'error' && row.error_message !== NOT_FOUND_MESSAGE) patch.error_message = NOT_FOUND_MESSAGE;
    if (status !== 'error' && row.error_message) patch.error_message = null;
    if (renewQr && status === 'pending') {
      const qr = extractQr(await this.evolution.connect(name));
      if (qr && qr !== row.qr_code) patch.qr_code = qr;
    }

    return Object.keys(patch).length ? this.update(row.id, patch) : row;
  }

  private async get(lineId: string): Promise<WhatsAppLineRow> {
    const { data } = await this.table().select('*').eq('id', lineId).maybeSingle();
    if (!data) throw new NotFoundException('Línea no encontrada');
    return data as WhatsAppLineRow;
  }

  private async update(lineId: string, patch: Partial<WhatsAppLineRow>): Promise<WhatsAppLineRow> {
    const { data, error } = await this.table().update(patch).eq('id', lineId).select().single();
    if (error) throw new BadRequestException(error.message);
    return data as WhatsAppLineRow;
  }

  private table() {
    return this.db.getAdminClient().from('whatsapp_lines');
  }
}
