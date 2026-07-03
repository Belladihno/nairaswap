import { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('NairaSwap API')
    .setDescription(
      'NGN / USDT On & Off Ramp Platform — simulated cryptocurrency on/off ramp for Nigerian users.',
    )
    .setVersion('1.0')
    .setContact('Abimbola Omisakin', '', '')
    .addServer('http://localhost:3000', 'Development server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Enter your JWT access token (returned from login/register)',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  const customOptions: SwaggerCustomOptions = {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
    customSiteTitle: 'NairaSwap API Docs',
  };

  SwaggerModule.setup('docs', app, document, customOptions);
}
