import { Controller, Post, Body } from '@nestjs/common';
import { EmailService } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';

@Controller('email')
export class EmailController {
  constructor(private emailService: EmailService) {}

  /**
   * POST /email/send
   *
   * Envía un email usando una plantilla específica
   *
   * Body:
   * {
   *   "to": "destinatario@example.com",
   *   "template": "invitation",
   *   "params": {
   *     "inviterName": "Juan Pérez",
   *     "inviterCompany": "Mi Empresa",
   *     "invitationUrl": "https://app.example.com/invite/abc123",
   *     "role": "admin"
   *   }
   * }
   */
  @Post('send')
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    const { to, template, params } = sendEmailDto;

    const result = await this.emailService.sendTemplatedEmail(
      to,
      template,
      params,
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      messageId: result.messageId,
    };
  }

  /**
   * POST /email/verify
   *
   * Verifica la conexión SMTP (útil para debugging)
   */
  @Post('verify')
  async verifyConnection() {
    const isConnected = await this.emailService.verifyConnection();

    return {
      success: isConnected,
      message: isConnected
        ? 'Conexión SMTP exitosa'
        : 'Error en conexión SMTP',
    };
  }
}
