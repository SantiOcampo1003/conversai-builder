import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { resolveDataFields } from '../langchain/data-fields';
import { computeStage } from '../langchain/lead-stage';
import { EvolutionClient } from './evolution.client';
import {
  DEFAULT_TEMPLATE,
  Recipient,
  normalizePhone,
  pickRecipients,
  renderTemplate,
} from './notification-format';

interface NotificationRow {
  id: string;
  agent_id: string;
  enabled: boolean;
  message_template: string;
  route_field: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly evolution: EvolutionClient,
  ) {}

  private async loadAgent(agentId: string) {
    const { data } = await this.db
      .getAdminClient()
      .from('agents')
      .select('data_fields, required_info')
      .eq('agent_id', agentId)
      .maybeSingle();
    return resolveDataFields((data as any) ?? { data_fields: null, required_info: null });
  }

  private async loadNotification(agentId: string): Promise<{ n: NotificationRow; recipients: Recipient[] } | null> {
    const admin = this.db.getAdminClient();
    const { data: n } = await admin
      .from('agent_notifications')
      .select('id, agent_id, enabled, message_template, route_field')
      .eq('agent_id', agentId)
      .eq('trigger', 'lead_complete')
      .maybeSingle();
    if (!n) return null;
    const { data: recipients } = await admin
      .from('agent_notification_recipients')
      .select('match_value, phone, label, enabled')
      .eq('notification_id', (n as NotificationRow).id);
    return { n: n as NotificationRow, recipients: (recipients ?? []) as Recipient[] };
  }

  private async instanceOf(agentId: string): Promise<string | null> {
    const { data } = await this.db
      .getAdminClient()
      .from('whatsapp_lines')
      .select('evolution_instance_name, status')
      .eq('agent_id', agentId)
      .order('updated_at', { ascending: false });
    const lines = (data ?? []) as { evolution_instance_name: string; status: string }[];
    return (lines.find((l) => l.status === 'connected') ?? lines[0])?.evolution_instance_name ?? null;
  }

  private async log(row: {
    agent_id: string;
    notification_id: string;
    customer_id: string;
    recipient_phone: string;
    recipient_label?: string | null;
    status: 'sent' | 'failed';
    error?: string | null;
    is_test?: boolean;
  }) {
    await this.db.getAdminClient().from('notification_log').insert(row);
  }

  /**
   * Se llama después de guardar datos de una persona. Si el contacto ya tiene todos los datos obligatorios
   * y no se avisó antes, envía el mensaje al closer que corresponde. Una sola vez por contacto.
   * Nunca lanza: un fallo aquí no debe afectar la conversación.
   */
  async notifyIfComplete(agentId: string, customerId: string): Promise<'sent' | 'skipped' | 'failed'> {
    // Los contactos de prueba nunca avisan a nadie
    if (customerId.startsWith('test_')) return 'skipped';
    try {
      const cfg = await this.loadNotification(agentId);
      if (!cfg || !cfg.n.enabled) return 'skipped';

      const fields = await this.loadAgent(agentId);
      const admin = this.db.getAdminClient();
      const { data: lead } = await admin
        .from('leads')
        .select('additional_fields, notified_at')
        .eq('agent_id', agentId)
        .eq('customer_id', customerId)
        .maybeSingle();
      if (!lead || (lead as any).notified_at) return 'skipped';
      const data = ((lead as any).additional_fields ?? {}) as Record<string, unknown>;
      if (!computeStage(fields, data).complete) return 'skipped';

      // Reclamar el aviso de forma atómica: si dos guardados llegan a la vez, solo uno envía.
      const { data: claimed } = await admin
        .from('leads')
        .update({ notified_at: new Date().toISOString() })
        .eq('agent_id', agentId)
        .eq('customer_id', customerId)
        .is('notified_at', null)
        .select('customer_id');
      if (!claimed || claimed.length === 0) return 'skipped';

      const recipients = pickRecipients(cfg.recipients, cfg.n.route_field, data);
      if (recipients.length === 0) {
        await this.log({ agent_id: agentId, notification_id: cfg.n.id, customer_id: customerId, recipient_phone: '-', status: 'failed', error: 'No hay destinatarios para este contacto' });
        await admin.from('leads').update({ notified_at: null }).eq('agent_id', agentId).eq('customer_id', customerId);
        return 'failed';
      }

      const instance = await this.instanceOf(agentId);
      const text = renderTemplate(cfg.n.message_template || DEFAULT_TEMPLATE, { fields, data, contactId: customerId });
      let sent = 0;
      for (const r of recipients) {
        const phone = normalizePhone(r.phone)!;
        const error = instance
          ? await this.evolution.sendText(instance, phone, text)
          : 'Este agente no tiene una línea de WhatsApp conectada';
        if (!error) sent++;
        await this.log({
          agent_id: agentId, notification_id: cfg.n.id, customer_id: customerId,
          recipient_phone: phone, recipient_label: r.label ?? null, status: error ? 'failed' : 'sent', error,
        });
      }
      // Si no salió ninguno, se libera para reintentar en el siguiente guardado
      if (sent === 0) {
        await admin.from('leads').update({ notified_at: null }).eq('agent_id', agentId).eq('customer_id', customerId);
        return 'failed';
      }
      return 'sent';
    } catch (e) {
      this.logger.error(`Notificación falló (${agentId}/${customerId}): ${(e as Error).message}`);
      return 'failed';
    }
  }

  /**
   * Envía los avisos que no salieron: contactos reales ya completos con notified_at vacío (por ejemplo, completos
   * antes de configurar los closers). Uno por uno; el reclamo atómico evita duplicados.
   */
  async notifyPending(agentId: string): Promise<{ sent: number; skipped: number; failed: number }> {
    const { data } = await this.db
      .getAdminClient()
      .from('leads')
      .select('customer_id')
      .eq('agent_id', agentId)
      .is('notified_at', null)
      .not('customer_id', 'like', 'test\\_%')
      .limit(500);
    const out = { sent: 0, skipped: 0, failed: 0 };
    for (const l of (data ?? []) as { customer_id: string }[]) {
      out[await this.notifyIfComplete(agentId, l.customer_id)]++;
    }
    return out;
  }

  /** Envía un mensaje de prueba a un destinatario YA guardado de este agente (no sirve para escribir a números cualquiera). */
  async sendTest(agentId: string, phone: string): Promise<string | null> {
    if (!this.evolution.isConfigured()) return 'La conexión con WhatsApp no está configurada en el servidor';
    const cfg = await this.loadNotification(agentId);
    if (!cfg) return 'Primero guarda la notificación';
    const target = normalizePhone(phone);
    const known = cfg.recipients.some((r) => normalizePhone(r.phone) === target);
    if (!target || !known) return 'Ese número no está en la lista de destinatarios guardada';

    const instance = await this.instanceOf(agentId);
    if (!instance) return 'Este agente no tiene una línea de WhatsApp conectada';
    const fields = await this.loadAgent(agentId);
    const sample: Record<string, unknown> = {};
    fields.forEach((f) => (sample[f.key] = `(ejemplo: ${f.label})`));
    const text = `🧪 MENSAJE DE PRUEBA\n\n${renderTemplate(cfg.n.message_template || DEFAULT_TEMPLATE, { fields, data: sample, contactId: '573001234567' })}`;
    const error = await this.evolution.sendText(instance, target, text);
    await this.log({
      agent_id: agentId, notification_id: cfg.n.id, customer_id: '(prueba)', recipient_phone: target,
      status: error ? 'failed' : 'sent', error, is_test: true,
    });
    return error;
  }
}
