import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvolutionState } from './line-state';

// Mensajes exactos de Evolution v2 cuando la instancia no existe
const INSTANCE_MISSING = /^The ".+" instance does not exist$|^Instance ".+" not found$/;

/** Mensaje legible de una respuesta de error de Evolution. */
function evolutionMessage(text: string): string {
  try {
    const body = JSON.parse(text);
    const msg = body?.response?.message ?? body?.message ?? body?.error;
    return (Array.isArray(msg) ? msg.join(', ') : String(msg ?? text)).slice(0, 200);
  } catch {
    return text.slice(0, 200) || 'sin detalle';
  }
}

/** Gestión de instancias (líneas) en Evolution. La llave global solo vive en el servidor. */
@Injectable()
export class EvolutionInstancesClient {
  constructor(private readonly config: ConfigService) {}

  create(instanceName: string, webhookUrl: string): Promise<any> {
    return this.request('POST', '/instance/create', {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: true, events: ['MESSAGES_UPSERT'] },
    });
  }

  /** Devuelve el QR vigente (o uno nuevo si la sesión estaba cerrada). */
  connect(instanceName: string): Promise<any> {
    return this.request('GET', `/instance/connect/${encodeURIComponent(instanceName)}`);
  }

  async connectionState(instanceName: string): Promise<EvolutionState> {
    const data = await this.request('GET', `/instance/connectionState/${encodeURIComponent(instanceName)}`, undefined, {
      notFound: null,
    });
    if (data === null) return 'not_found';
    const state = data?.instance?.state ?? data?.state;
    return state === 'open' || state === 'connecting' ? state : 'close';
  }

  async ownerJid(instanceName: string): Promise<string | null> {
    const data = await this.request('GET', `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`);
    return (Array.isArray(data) ? data[0]?.ownerJid : data?.ownerJid) ?? null;
  }

  async logout(instanceName: string): Promise<void> {
    await this.request('DELETE', `/instance/logout/${encodeURIComponent(instanceName)}`, undefined, { notFound: null });
  }

  /** Borrar una instancia que ya no existe cuenta como éxito. */
  async remove(instanceName: string): Promise<void> {
    await this.request('DELETE', `/instance/delete/${encodeURIComponent(instanceName)}`, undefined, { notFound: null });
  }

  private async request(method: string, path: string, body?: unknown, opts: { notFound?: null } = {}): Promise<any> {
    const base = (this.config.get<string>('EVOLUTION_API_URL') ?? '').replace(/\/$/, '');
    const key = this.config.get<string>('EVOLUTION_API_KEY');
    if (!base || !key) throw new Error('Falta configurar EVOLUTION_API_URL y EVOLUTION_API_KEY en el servidor');

    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    // Solo el 404 propio de Evolution significa "la instancia no existe"; otro 404 es configuración rota
    if (res.status === 404 && 'notFound' in opts && INSTANCE_MISSING.test(evolutionMessage(text))) return opts.notFound;
    if (!res.ok) {
      throw new BadGatewayException(`WhatsApp (Evolution) respondió ${res.status}: ${evolutionMessage(text)}`);
    }
    return text ? JSON.parse(text) : null;
  }
}
