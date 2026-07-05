import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/pipes';
import { setupSwagger } from './common/swagger';
import { AppConfigService } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );

  setupSwagger(app);

  const appConfig = app.get(AppConfigService);
  const port = appConfig.appPort;

  await app.listen(port);

  logger.log(
    { event: 'application.started', port },
    `Application listening on port ${port}`,
  );
}

void bootstrap();
