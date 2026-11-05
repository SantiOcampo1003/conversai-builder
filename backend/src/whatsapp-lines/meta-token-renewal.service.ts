import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { decryptToken, encryptToken } from '../whatsapp-cloud/token-crypto';
import { WhatsAppCloudClient } from '../whatsapp-cloud/whatsapp-cloud.client';

/** Se renueva cuando faltan estos días o menos: deja margen si el backend no corre algún día (redeploy, caída). */
export const RENEW_WINDOW_DAYS = 15;

interface TokenLine {
  id: string;
  meta_access_token_encrypted: string;
  meta_token_expires_at: string | null;
}

/**
 * Los tokens de Embedded Signup duran 60 días: cada día se renuevan los que están por vencer.
 * Va en el backend (no en pg_cron) porque llama a Meta y usa la llave de cifrado (DEVELOPMENT_STANDARDS.md → Tareas Programadas).
 */
@Injectable()
export class MetaTokenRenewalService {
  private readonly logger = new Logger(MetaTokenRenewalService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly cloud: WhatsAppCloudClient,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'America/Bogota' })
  async handleCron(): Promise<void> {
    const result = await this.renewDueTokens();
    this.logger.log(`Tokens de Meta: ${result.renewed} renovados, ${result.failed} con error, ${result.filled} fechas completadas`);
  }

  async renewDueTokens(now = new Date()): Promise<{ renewed: number; failed: number; filled: number }> {
    const key = this.config.get<string>('WHATSAPP_TOKEN_ENCRYPTION_KEY');
    const { data, error } = await this.table()
      .select('id, meta_access_token_encrypted, meta_token_expires_at')
      .eq('provider', 'meta_cloud')
      .not('meta_access_token_encrypted', 'is', null);
    if (error) throw new Error(error.message);

    const dueBefore = now.getTime() + RENEW_WINDOW_DAYS * 86_400_000;
    const result = { renewed: 0, failed: 0, filled: 0 };
    // Una a una: son pocas líneas y un fallo no debe detener las demás
    for (const line of (data ?? []) as TokenLine[]) {
      const previous = line.meta_access_token_encrypted;
      try {
        const token = decryptToken(previous, key);
        let expiresAt = line.meta_token_expires_at ? new Date(line.meta_token_expires_at) : null;
        if (!expiresAt) {
          expiresAt = (await this.cloud.debugToken(token)).expiresAt;
          if (!expiresAt) continue; // no vence
          await this.save(line.id, previous, { meta_token_expires_at: expiresAt.toISOString() });
          result.filled++;
        }
        if (expiresAt.getTime() > dueBefore) continue;

        const renewed = await this.cloud.refreshToken(token);
        await this.save(line.id, previous, {
          meta_access_token_encrypted: encryptToken(renewed.accessToken, key),
          meta_token_expires_at: renewed.expiresAt?.toISOString() ?? null,
          meta_token_refresh_error: null,
        });
        result.renewed++;
      } catch (e) {
        const message = (e as Error).message;
        this.logger.warn(`No se pudo renovar el token de Meta de la línea ${line.id}: ${message}`);
        await this.save(line.id, previous, {
          meta_token_refresh_error: `No se pudo renovar el acceso a Meta: ${message}. Reconecta con Facebook.`,
        }).catch(() => undefined);
        result.failed++;
      }
    }
    return result;
  }

  /** Solo si el token sigue siendo el que se leyó: si otra renovación ganó, esta no la pisa. */
  private async save(id: string, previousToken: string, changes: Record<string, unknown>): Promise<void> {
    const { error } = await this.table().update(changes).eq('id', id).eq('meta_access_token_encrypted', previousToken);
    if (error) throw new Error(error.message);
  }

  private table() {
    return this.db.getAdminClient().from('whatsapp_lines');
  }
}
