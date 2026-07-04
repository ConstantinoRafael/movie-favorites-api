import { Module } from '@nestjs/common';
import { AppConfigModule } from './config';
import { HealthModule } from './modules/health';
import { PrismaModule } from './prisma';

@Module({
  imports: [AppConfigModule, PrismaModule, HealthModule],
})
export class AppModule {}
