import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Envío de texto por WhatsApp usando la API de Evolution desde el backend. */
@Injectable()
export class EvolutionClient {
  private readonly logger = new Logger(EvolutionClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('EVOLUTION_API_URL') && !!this.config.get<string>('EVOLUTION_API_KEY');
  }

  /** Devuelve null si salió bien, o el motivo del error en español. */
  async sendText(instance: string, phoneDigits: string, text: string): Promise<string | null> {
    const base = (this.config.get<string>('EVOLUTION_API_URL') ?? '').replace(/\/$/, '');
    const key = this.config.get<string>('EVOLUTION_API_KEY');
    if (!base || !key) return 'Falta configurar EVOLUTION_API_URL y EVOLUTION_API_KEY en el servidor';
    try {
      const res = await fetch(`${base}/message/sendText/${encodeURIComponent(instance)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ number: phoneDigits, text }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return null;
      const body = (await res.text()).slice(0, 200);
      this.logger.warn(`Evolution respondió ${res.status}: ${body}`);
      return `WhatsApp respondió ${res.status}${body ? `: ${body}` : ''}`;
    } catch (e) {
      return `No se pudo contactar a WhatsApp: ${(e as Error).message}`;
    }
  }
}
