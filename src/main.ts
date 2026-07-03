import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { json, Request, Response } from 'express';
import { setupSwagger } from './common/swagger/setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  setupSwagger(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.use(
    '/deposits/webhook',
    json({
      verify: (req: Request, _res: Response, buf: Buffer) => {
        (req as unknown as { rawBody: string }).rawBody = buf.toString();
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
