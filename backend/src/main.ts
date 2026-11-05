import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: el webhook de Meta firma el cuerpo crudo (X-Hub-Signature-256)
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Enable CORS
  app.enableCors();

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;

  await app.listen(port);

  console.log('\n' + '='.repeat(60));
  console.log('🚀 ConversAI Backend (NestJS + LangChain)');
  console.log('='.repeat(60));
  console.log(`📍 Server running on port ${port}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${port}`);
  console.log(`📡 Health: http://localhost:${port}/api/chat/health`);
  console.log('='.repeat(60) + '\n');
}

bootstrap();
