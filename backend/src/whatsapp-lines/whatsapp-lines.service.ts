import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { encryptToken } from '../whatsapp-cloud/token-crypto';
import { WhatsAppCloudClient } from '../whatsapp-cloud/whatsapp-cloud.client';
import { EvolutionInstancesClient } from './evolution-instances.client';
import { extractQr, LineStatus, mapEvolutionState, phoneFromOwnerJid } from './line-state';

export type LineProvider = 'evolution' | 'meta_cloud';

export interface WhatsAppLineRow {
  id: string;
  client_id: string;
  line_name: string;
  phone_number: string | null;
  agent_id: string | null;
  status: LineStatus;
  /** `evolution` = QR (WhatsApp Web); `meta_cloud` = API oficial de Meta. */
  provider: LineProvider;
  /** Solo líneas `evolution`. */
  evolution_instance_name: string | null;
  /** Solo líneas `meta_cloud`. */
  meta_phone_number_id: string | null;
  meta_waba_id: string | null;
  qr_code: string | null;
  last_connected_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/** Columnas que se devuelven al navegador: nunca el token cifrado de Meta. */
const LINE_COLUMNS =
  'id, client_id, line_name, phone_number, agent_id, status, provider, evolution_instance_name, meta_phone_number_id, meta_waba_id, qr_code, last_connected_at, error_message, created_at, updated_at';

export const DUPLICATED_NUMBER_MESSAGE = 'Ese número ya está conectado a una línea.';
export const NOT_FOUND_MESSAGE = 'La instancia ya no existe en WhatsApp. Elimina la línea y crea una nueva.';
export const SYNC_ERROR_MESSAGE = 'No se pudo consultar WhatsApp; se muestra el último estado guardado.';
export const META_MANAGED_MESSAGE = 'Esta línea usa la API oficial de WhatsApp y se gestiona desde Meta.';

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
    private readonly cloud: WhatsAppCloudClient,
  ) {}

  /** Líneas del cliente con su estado sincronizado. Si Evolution falla se devuelve lo guardado. */
  async listAndSync(clientId: string): Promise<{ lines: WhatsAppLineRow[]; syncError: string | null }> {
    const { data, error } = await this.table()
      .select(LINE_COLUMNS)
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

  /**
   * Estado de una línea. Con `renewQr` (solo para quien gestiona la línea) y si sigue esperando
   * escaneo, trae el QR vigente: Evolution lo cambia cada ~45 s.
   */
  async refresh(lineId: string, renewQr: boolean): Promise<WhatsAppLineRow> {
    return this.sync(await this.get(lineId), renewQr);
  }

  async create(clientId: string, lineName: string): Promise<WhatsAppLineRow> {
    const instanceName = `line_${Date.now()}_${Math.random().toString(36).slice(2, 11).padEnd(9, '0')}`;
    const webhook = this.config.get<string>('WHATSAPP_INCOMING_WEBHOOK_URL') || DEFAULT_WEBHOOK_URL;

    const created = await this.evolution.create(instanceName, webhook);
    const qr = extractQr(created) ?? extractQr(await this.evolution.connect(instanceName).catch(() => null));

    const { data, error } = await this.table()
      .insert({ client_id: clientId, line_name: lineName.trim(), evolution_instance_name: instanceName, status: 'pending', qr_code: qr })
      .select(LINE_COLUMNS)
      .single();
    if (error) {
      // No dejar instancias huérfanas en Evolution (p. ej. límite de líneas alcanzado)
      await this.evolution.remove(instanceName).catch(() => undefined);
      throw new BadRequestException(error.message);
    }
    return data as WhatsAppLineRow;
  }

  /**
   * Línea por la API oficial con un número que el token de la plataforma ya administra (p. ej. el número de prueba
   * de Meta). Valida el número con Meta y, si se indica la WABA, suscribe la app a sus webhooks.
   */
  async createMetaLine(clientId: string, lineName: string, phoneNumberId: string, wabaId: string | null): Promise<WhatsAppLineRow> {
    let phone: { displayPhoneNumber: string };
    try {
      phone = await this.cloud.getPhoneNumber(phoneNumberId);
    } catch (e) {
      throw new BadRequestException(`Meta no reconoce ese Phone Number ID o el token no tiene acceso: ${(e as Error).message}`);
    }
    if (wabaId) await this.cloud.subscribeApp(wabaId);

    const { data, error } = await this.table()
      .insert({
        client_id: clientId,
        line_name: lineName.trim(),
        provider: 'meta_cloud',
        evolution_instance_name: null,
        meta_phone_number_id: phoneNumberId,
        meta_waba_id: wabaId,
        phone_number: phone.displayPhoneNumber.replace(/\D/g, ''),
        status: 'connected',
        last_connected_at: new Date().toISOString(),
      })
      .select(LINE_COLUMNS)
      .single();
    if (error) throw new BadRequestException(insertErrorMessage(error.message));
    return data as WhatsAppLineRow;
  }

  /**
   * "Conectar con Facebook": el cliente conectó su propio número en el popup de Embedded Signup.
   * Cambia el code por el token de su cuenta, suscribe la app a su WABA, registra el número en la
   * Cloud API y guarda la línea con el token cifrado.
   */
  async connectWithEmbeddedSignup(
    clientId: string,
    lineName: string,
    code: string,
    phoneNumberId: string,
    wabaId: string,
  ): Promise<WhatsAppLineRow> {
    // Antes de gastar el code (sirve una sola vez): llave configurada, cupo de líneas y número libre
    const encryptionKey = this.config.get<string>('WHATSAPP_TOKEN_ENCRYPTION_KEY');
    try {
      encryptToken('prueba', encryptionKey);
    } catch (e) {
      throw new InternalServerErrorException((e as Error).message);
    }
    await this.assertLineAvailable(clientId);
    const { data: existing } = await this.table().select('id').eq('meta_phone_number_id', phoneNumberId).maybeSingle();
    if (existing) throw new BadRequestException(DUPLICATED_NUMBER_MESSAGE);

    let token: string;
    try {
      token = await this.cloud.exchangeCode(code);
    } catch (e) {
      throw new BadRequestException(`Facebook no confirmó la conexión; vuelve a intentarlo. (${(e as Error).message})`);
    }

    try {
      await this.cloud.subscribeApp(wabaId, token);
    } catch (e) {
      throw new BadRequestException(`No se pudo activar la recepción de mensajes de tu cuenta de WhatsApp: ${(e as Error).message}`);
    }

    const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
    try {
      await this.cloud.registerPhoneNumber(phoneNumberId, pin, token);
    } catch (e) {
      const message = (e as Error).message;
      if (!/already registered|ya est[aá] registrado/i.test(message)) {
        throw new BadRequestException(
          `Meta no permitió activar el número. Si tiene verificación en dos pasos, desactívala en WhatsApp Manager y vuelve a intentarlo. (${message})`,
        );
      }
    }

    const phone = await this.cloud.getPhoneNumber(phoneNumberId, token);
    const { data, error } = await this.table()
      .insert({
        client_id: clientId,
        line_name: lineName.trim(),
        provider: 'meta_cloud',
        evolution_instance_name: null,
        meta_phone_number_id: phoneNumberId,
        meta_waba_id: wabaId,
        meta_access_token_encrypted: encryptToken(token, encryptionKey),
        phone_number: phone.displayPhoneNumber.replace(/\D/g, ''),
        status: 'connected',
        last_connected_at: new Date().toISOString(),
      })
      .select(LINE_COLUMNS)
      .single();
    if (error) throw new BadRequestException(insertErrorMessage(error.message));
    return data as WhatsAppLineRow;
  }

  async reconnect(lineId: string): Promise<WhatsAppLineRow> {
    const row = await this.evolutionLine(lineId);
    const qr = extractQr(await this.evolution.connect(row.evolution_instance_name!));
    return this.update(row.id, { qr_code: qr, status: 'pending', error_message: null });
  }

  async logout(lineId: string): Promise<WhatsAppLineRow> {
    const row = await this.evolutionLine(lineId);
    await this.evolution.logout(row.evolution_instance_name!);
    return this.update(row.id, { status: 'disconnected', phone_number: null, qr_code: null });
  }

  async remove(lineId: string): Promise<void> {
    const row = await this.get(lineId);
    // Las líneas de la API oficial no tienen instancia en Evolution
    if (row.provider !== 'meta_cloud') await this.evolution.remove(row.evolution_instance_name!);
    const { error } = await this.table().delete().eq('id', row.id);
    if (error) throw new BadRequestException(error.message);
  }

  async clientIdOf(lineId: string): Promise<string> {
    return (await this.get(lineId)).client_id;
  }

  /** Compara con Evolution y guarda solo si algo cambió. Las líneas de Meta se devuelven tal cual. */
  private async sync(row: WhatsAppLineRow, renewQr: boolean): Promise<WhatsAppLineRow> {
    if (row.provider === 'meta_cloud') return row;
    const name = row.evolution_instance_name!;
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

  /** La línea, solo si es de Evolution: reconectar o cerrar sesión no aplica a la API oficial. */
  private async evolutionLine(lineId: string): Promise<WhatsAppLineRow> {
    const row = await this.get(lineId);
    if (row.provider === 'meta_cloud') throw new BadRequestException(META_MANAGED_MESSAGE);
    return row;
  }

  /** El mismo límite que aplica la base al crear líneas (trigger check_whatsapp_lines_limit). */
  private async assertLineAvailable(clientId: string): Promise<void> {
    const [{ count }, { data: client }] = await Promise.all([
      this.table().select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      this.db.getAdminClient().from('clients').select('max_whatsapp_lines').eq('id', clientId).maybeSingle(),
    ]);
    const max = (client as { max_whatsapp_lines: number | null } | null)?.max_whatsapp_lines;
    if (!client) throw new NotFoundException('Cliente no encontrado');
    if (max != null && (count ?? 0) >= max) {
      throw new BadRequestException(`Llegaste al límite de ${max} líneas de WhatsApp. Elimina una línea o amplía tu plan.`);
    }
  }

  private async get(lineId: string): Promise<WhatsAppLineRow> {
    const { data } = await this.table().select(LINE_COLUMNS).eq('id', lineId).maybeSingle();
    if (!data) throw new NotFoundException('Línea no encontrada');
    return data as WhatsAppLineRow;
  }

  private async update(lineId: string, patch: Partial<WhatsAppLineRow>): Promise<WhatsAppLineRow> {
    const { data, error } = await this.table().update(patch).eq('id', lineId).select(LINE_COLUMNS).single();
    if (error) throw new BadRequestException(error.message);
    return data as WhatsAppLineRow;
  }

  private table() {
    return this.db.getAdminClient().from('whatsapp_lines');
  }
}

function insertErrorMessage(message: string): string {
  return /whatsapp_lines_meta_phone_number_id_key|duplicate key/i.test(message) ? DUPLICATED_NUMBER_MESSAGE : message;
}
