import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '@app/app.module';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  // Pipes
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));

  // Prefix
  app.setGlobalPrefix('api');

  // Get environment variables
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';

  const port = process.env.PORT || configService.get<number>('APP_PORT');

  const enableSwagger = configService.get<boolean>('ENABLE_SWAGGER', true);

  // Swagger Configuration (only in development or if explicitly enabled)
  if (enableSwagger && (nodeEnv === 'development' || nodeEnv === 'staging')) {
    const config = new DocumentBuilder()
      .setTitle('Stack App API')
      .setDescription('API documentation for Stack App application')
      .setVersion('1.0')
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('keep-alive', 'Keep-alive service endpoints')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth'
      );

    // Add servers based on environment
    if (nodeEnv === 'development') {
      config.addServer(`http://localhost:${port}`, 'Development server');
    } else if (nodeEnv === 'staging') {
      config.addServer(`https://staging-api.todovillage.com`, 'Staging server');
      config.addServer(`http://localhost:${port}`, 'Local development');
    } else if (nodeEnv === 'production') {
      config.addServer(`https://api.todovillage.com`, 'Production server');
    }

    const document = SwaggerModule.createDocument(app, config.build());
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });
  }

  // Start server
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`🌍 Environment: ${nodeEnv}`);

  if (enableSwagger && (nodeEnv === 'development' || nodeEnv === 'staging')) {
    console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  }

  await app.listen(port, '0.0.0.0');
}

bootstrap();
