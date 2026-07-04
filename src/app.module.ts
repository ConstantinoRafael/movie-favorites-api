import { Module } from '@nestjs/common';
import { AppConfigModule } from './config';
import { HealthModule } from './modules/health';

@Module({
  imports: [AppConfigModule, HealthModule],
})
export class AppModule {}
