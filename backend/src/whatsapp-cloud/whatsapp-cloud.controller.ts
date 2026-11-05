import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Logger, Post, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { isValidSignature } from './webhook-payload';
import { WhatsAppCloudService } from './whatsapp-cloud.service';

/** Webhook de la Cloud API de Meta. Se configura en la app de Meta → WhatsApp → Configuración. */
@Controller('api/whatsapp-cloud/webhook')
export class WhatsAppCloudController {
  private readonly logger = new Logger(WhatsAppCloudController.name);

  constructor(
    private readonly service: WhatsAppCloudService,
    private readonly config: ConfigService,
  ) {}

  /** Meta valida la URL con hub.challenge al guardar el webhook. */
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode !== 'subscribe' || !expected || token !== expected) throw new ForbiddenException('Verify token inválido');
    return challenge;
  }

  /** Responde 200 de inmediato (Meta espera respuesta rápida) y procesa en segundo plano. */
  @Post()
  @HttpCode(200)
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: unknown,
  ): { ok: true } {
    if (!isValidSignature(req.rawBody, signature, this.config.get<string>('META_APP_SECRET') ?? '')) {
      throw new ForbiddenException('Firma inválida');
    }
    void this.service.handleWebhook(payload).catch((e) => this.logger.error(`Error procesando webhook: ${(e as Error).message}`));
    return { ok: true };
  }
}
