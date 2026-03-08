import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface EmailTemplate {
  subject: string;
  html: string;
}

interface TemplateConfig {
  subject: string;
  headerTitle: string;
  headerSubtitle?: string;
}

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private templatesPath: string;

  constructor(private configService: ConfigService) {
    // Configurar transporter de Gmail
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });

    // Path a los templates
    this.templatesPath = path.join(__dirname, 'templates');

    // Registrar partials de Handlebars
    this.registerPartials();
  }

  /**
   * Registra los partials de Handlebars (header, footer, button, etc.)
   */
  private registerPartials() {
    const partialsPath = path.join(this.templatesPath, 'partials');

    if (fs.existsSync(partialsPath)) {
      const partialFiles = fs.readdirSync(partialsPath);

      partialFiles.forEach((file) => {
        if (file.endsWith('.hbs')) {
          const partialName = file.replace('.hbs', '');
          const partialContent = fs.readFileSync(
            path.join(partialsPath, file),
            'utf-8',
          );
          Handlebars.registerPartial(partialName, partialContent);
        }
      });

      console.log(`✅ Registrados ${partialFiles.length} partials de Handlebars`);
    }
  }

  /**
   * Compila un template de Handlebars con el layout base
   */
  private compileTemplate(
    templateName: string,
    params: Record<string, any>,
    config: TemplateConfig,
  ): string {
    // Leer el template específico
    const templatePath = path.join(
      this.templatesPath,
      `${templateName}.hbs`,
    );
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    // Leer el layout base
    const layoutPath = path.join(this.templatesPath, 'layouts', 'base.hbs');
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    // Compilar el template específico
    const compiledTemplate = Handlebars.compile(templateContent);
    const bodyHtml = compiledTemplate(params);

    // Compilar el layout con el body
    const compiledLayout = Handlebars.compile(layoutContent);
    const finalHtml = compiledLayout({
      subject: config.subject,
      headerTitle: config.headerTitle,
      headerSubtitle: config.headerSubtitle,
      body: bodyHtml,
      ...params,
    });

    return finalHtml;
  }

  /**
   * Envía un email usando una plantilla específica
   * @param to - Email del destinatario
   * @param templateName - Nombre de la plantilla a usar
   * @param params - Parámetros para reemplazar en la plantilla
   */
  async sendTemplatedEmail(
    to: string,
    templateName: string,
    params: Record<string, any>,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log(`📧 Enviando email a: ${to} con plantilla: ${templateName}`);
      console.log(`📋 Parámetros:`, params);

      // Obtener configuración del template
      const config = this.getTemplateConfig(templateName, params);

      if (!config) {
        throw new Error(`Plantilla "${templateName}" no encontrada`);
      }

      // Compilar template con Handlebars
      const html = this.compileTemplate(templateName, params, config);

      // Enviar email
      const info = await this.transporter.sendMail({
        from: `"${this.configService.get<string>('SMTP_FROM_NAME', 'ConversAI Builder')}" <${this.configService.get<string>('SMTP_USER')}>`,
        to,
        subject: config.subject,
        html,
      });

      console.log(`✅ Email enviado: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Obtiene la configuración específica de cada template
   * (subject, headerTitle, headerSubtitle)
   */
  private getTemplateConfig(
    templateName: string,
    params: Record<string, any>,
  ): TemplateConfig | null {
    switch (templateName) {
      case 'invitation':
        return {
          subject: `${params.inviterName} te ha invitado a unirte a ${params.inviterCompany}`,
          headerTitle: 'easy',
          headerSubtitle: 'AI AGENTS',
        };

      case 'welcome':
        return {
          subject: `🚀 ¡Bienvenido a easy, ${params.name}!`,
          headerTitle: 'easy',
          headerSubtitle: 'AI AGENTS',
        };

      default:
        return null;
    }
  }

  /**
   * Verifica la conexión con el servidor SMTP
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Conexión SMTP verificada');
      return true;
    } catch (error) {
      console.error('❌ Error verificando conexión SMTP:', error);
      return false;
    }
  }
}
