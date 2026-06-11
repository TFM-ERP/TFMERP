import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { join } from 'path';
import { mkdirSync } from 'fs';

async function bootstrap() {
  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Serve uploaded files as static assets (before API prefix)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('TFM ERP API')
    .setDescription('The Film Makers FZ LLC — ERP System API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Finance', 'Finance & Accounting module')
    .addTag('Clients', 'CRM / Client Management')
    .addTag('Users', 'User Management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  // Local CPU TTS (ScriptON LOCAL engine) queues line synthesis — requests can legitimately
  // wait many minutes. Node's default requestTimeout (300s) would cut them mid-queue.
  const server = app.getHttpServer();
  server.requestTimeout = 0;        // no hard cap on in-flight requests
  server.headersTimeout = 120_000;  // still drop clients that never send headers
  console.log(`\n🚀 TFM ERP API running on: http://localhost:${port}/api/v1`);
  console.log(`📚 API Docs: http://localhost:${port}/api/docs\n`);
}
bootstrap();
