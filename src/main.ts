import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './common/swagger';
import { AppConfigService } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();
  setupSwagger(app);

  const appConfig = app.get(AppConfigService);
  await app.listen(appConfig.appPort);
}

void bootstrap();
