import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { DatabaseService } from '../database/database.service';
import { DataField } from '../common/types/agent.types';
import { resolveDataFields } from '../langchain/data-fields';
import {
  CONTACT_COLUMN_INDEX,
  LeadForSheet,
  buildHeaderRow,
  buildLeadRow,
  columnLetter,
  quoteSheetName,
} from './sheet-format';

interface Integration {
  id: string;
  agent_id: string;
  enabled: boolean;
  spreadsheet_id: string;
  sheet_name: string;
}

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private auth: GoogleAuth | null = null;
  private clientEmail: string | null = null;
  /** Cola por hoja: evita filas duplicadas cuando llegan dos guardados seguidos. */
  private queues = new Map<string, Promise<unknown>>();

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
  ) {
    const raw = this.config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!raw) {
      this.logger.warn('GOOGLE_SERVICE_ACCOUNT_JSON no configurada: la sincronización con Google Sheets está desactivada');
      return;
    }
    try {
      const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const creds = JSON.parse(text);
      this.clientEmail = creds.client_email ?? null;
      this.auth = new GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
      this.logger.log(`Google Sheets habilitado (${this.clientEmail})`);
    } catch (e) {
      this.logger.error(`GOOGLE_SERVICE_ACCOUNT_JSON inválida: ${(e as Error).message}`);
    }
  }

  isConfigured(): boolean {
    return this.auth !== null;
  }

  /** Correo con el que el cliente debe compartir su hoja. */
  getServiceAccountEmail(): string | null {
    return this.clientEmail;
  }

  private async api<T = any>(method: 'GET' | 'PUT' | 'POST', path: string, params?: Record<string, string>, body?: unknown): Promise<T> {
    if (!this.auth) throw new Error('La conexión con Google no está configurada en el servidor');
    const client = await this.auth.getClient();
    const url = new URL(`${SHEETS_API}/${path}`);
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    try {
      const res = await client.request<T>({ url: url.toString(), method, data: body });
      return res.data;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error?.message ?? e?.message ?? 'error desconocido';
      if (status === 403 || status === 404) {
        throw new Error(
          `No se puede acceder a la hoja. Compártela como Editor con ${this.clientEmail} y revisa el enlace (${msg})`,
        );
      }
      throw new Error(`Google respondió ${status ?? ''}: ${msg}`);
    }
  }

  private async getIntegration(agentId: string): Promise<Integration | null> {
    const { data, error } = await this.db
      .getAdminClient()
      .from('agent_integrations')
      .select('id, agent_id, enabled, spreadsheet_id, sheet_name')
      .eq('agent_id', agentId)
      .eq('provider', 'google_sheets')
      .maybeSingle();
    if (error) {
      this.logger.error(`Error leyendo integración de ${agentId}: ${error.message}`);
      return null;
    }
    return data as Integration | null;
  }

  private async getFields(agentId: string): Promise<DataField[]> {
    const { data } = await this.db
      .getAdminClient()
      .from('agents')
      .select('data_fields, required_info')
      .eq('agent_id', agentId)
      .maybeSingle();
    return resolveDataFields((data as any) ?? { data_fields: null, required_info: null });
  }

  private enqueue<T>(key: string, job: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(key) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(job);
    this.queues.set(key, next);
    next.finally(() => this.queues.get(key) === next && this.queues.delete(key)).catch(() => undefined);
    return next;
  }

  private async markResult(integrationId: string, error: string | null) {
    await this.db
      .getAdminClient()
      .from('agent_integrations')
      .update({ last_error: error, ...(error ? {} : { last_sync_at: new Date().toISOString() }), updated_at: new Date().toISOString() })
      .eq('id', integrationId);
  }

  private tabsOk = new Set<string>();

  /** Crea la pestaña si no existe (el cliente puede haber compartido una hoja con otro nombre de pestaña). */
  private async ensureTab(int: Integration) {
    const cacheKey = `${int.spreadsheet_id}|${int.sheet_name}`;
    if (this.tabsOk.has(cacheKey)) return;
    const meta = await this.api<{ sheets?: { properties?: { title?: string } }[] }>(
      'GET',
      int.spreadsheet_id,
      { fields: 'sheets.properties.title' },
    );
    const exists = (meta.sheets ?? []).some((s) => s.properties?.title === int.sheet_name);
    if (!exists) {
      await this.api('POST', `${int.spreadsheet_id}:batchUpdate`, undefined, {
        requests: [{ addSheet: { properties: { title: int.sheet_name } } }],
      });
    }
    this.tabsOk.add(cacheKey);
  }

  /** Escribe la fila de encabezados (siempre refleja las columnas actuales del agente). */
  private async writeHeader(int: Integration, fields: DataField[]) {
    await this.ensureTab(int);
    const header = buildHeaderRow(fields);
    const range = `${quoteSheetName(int.sheet_name)}!A1:${columnLetter(header.length)}1`;
    await this.api('PUT', `${int.spreadsheet_id}/values/${encodeURIComponent(range)}`, { valueInputOption: 'USER_ENTERED' }, { values: [header] });
  }

  /**
   * Llamado al guardar datos de una persona: actualiza su fila o agrega una nueva.
   * Nunca lanza: un fallo de Google no debe afectar la conversación.
   */
  async syncLead(agentId: string, customerId: string): Promise<void> {
    if (!this.isConfigured()) return;
    try {
      const int = await this.getIntegration(agentId);
      if (!int || !int.enabled) return;

      await this.enqueue(int.spreadsheet_id, async () => {
        try {
          const fields = await this.getFields(agentId);
          const { data: lead } = await this.db
            .getAdminClient()
            .from('leads')
            .select('customer_id,status,created_at,updated_at,additional_fields')
            .eq('agent_id', agentId)
            .eq('customer_id', customerId)
            .maybeSingle();
          if (!lead) return;

          await this.writeHeader(int, fields);
          const row = buildLeadRow(lead as LeadForSheet, fields);
          const colLetter = columnLetter(CONTACT_COLUMN_INDEX + 1);
          const colRange = `${quoteSheetName(int.sheet_name)}!${colLetter}:${colLetter}`;
          const existing = await this.api<{ values?: string[][] }>(
            'GET',
            `${int.spreadsheet_id}/values/${encodeURIComponent(colRange)}`,
          );
          const contacts = (existing.values ?? []).map((r) => (r[0] ?? '').replace(/^'/, ''));
          const idx = contacts.findIndex((c, i) => i > 0 && c === customerId);

          if (idx >= 0) {
            const rowNum = idx + 1;
            const range = `${quoteSheetName(int.sheet_name)}!A${rowNum}:${columnLetter(row.length)}${rowNum}`;
            await this.api('PUT', `${int.spreadsheet_id}/values/${encodeURIComponent(range)}`, { valueInputOption: 'USER_ENTERED' }, { values: [row] });
          } else {
            const range = `${quoteSheetName(int.sheet_name)}!A:A`;
            await this.api(
              'POST',
              `${int.spreadsheet_id}/values/${encodeURIComponent(range)}:append`,
              { valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS' },
              { values: [row] },
            );
          }
          await this.markResult(int.id, null);
        } catch (e) {
          this.logger.error(`Sheets sync falló (${agentId}): ${(e as Error).message}`);
          await this.markResult(int.id, (e as Error).message).catch(() => undefined);
        }
      });
    } catch (e) {
      this.logger.error(`Sheets sync inesperado (${agentId}): ${(e as Error).message}`);
    }
  }

  /** Comprueba el acceso a la hoja y escribe los encabezados. Devuelve el error en español o null si todo bien. */
  async testConnection(agentId: string): Promise<string | null> {
    if (!this.isConfigured()) return 'La conexión con Google no está configurada en el servidor';
    const int = await this.getIntegration(agentId);
    if (!int) return 'Primero guarda el enlace de la hoja';
    try {
      const fields = await this.getFields(agentId);
      if (fields.length === 0) return 'Define primero los datos a recoger del agente';
      await this.enqueue(int.spreadsheet_id, () => this.writeHeader(int, fields));
      await this.markResult(int.id, null);
      return null;
    } catch (e) {
      await this.markResult(int.id, (e as Error).message).catch(() => undefined);
      return (e as Error).message;
    }
  }

  /** Reescribe la hoja completa con todos los contactos del agente (más recientes primero). */
  async syncAll(agentId: string): Promise<{ error: string | null; rows: number }> {
    if (!this.isConfigured()) return { error: 'La conexión con Google no está configurada en el servidor', rows: 0 };
    const int = await this.getIntegration(agentId);
    if (!int) return { error: 'Primero guarda el enlace de la hoja', rows: 0 };
    try {
      const fields = await this.getFields(agentId);
      if (fields.length === 0) return { error: 'Define primero los datos a recoger del agente', rows: 0 };
      const { data: leads, error } = await this.db
        .getAdminClient()
        .from('leads')
        .select('customer_id,status,created_at,updated_at,additional_fields')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw new Error(error.message);

      const header = buildHeaderRow(fields);
      const values = [header, ...((leads ?? []) as LeadForSheet[]).map((l) => buildLeadRow(l, fields))];
      await this.enqueue(int.spreadsheet_id, async () => {
        await this.ensureTab(int);
        const sheet = quoteSheetName(int.sheet_name);
        await this.api('POST', `${int.spreadsheet_id}/values/${encodeURIComponent(`${sheet}!A:ZZ`)}:clear`, undefined, {});
        const range = `${sheet}!A1:${columnLetter(header.length)}${values.length}`;
        await this.api('PUT', `${int.spreadsheet_id}/values/${encodeURIComponent(range)}`, { valueInputOption: 'USER_ENTERED' }, { values });
      });
      await this.markResult(int.id, null);
      return { error: null, rows: values.length - 1 };
    } catch (e) {
      await this.markResult(int.id, (e as Error).message).catch(() => undefined);
      return { error: (e as Error).message, rows: 0 };
    }
  }
}
