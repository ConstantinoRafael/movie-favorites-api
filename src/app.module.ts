import { Module } from '@nestjs/common';
import { AppConfigModule } from './config';
import { HealthModule } from './modules/health';
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';

@Module({
  imports: [AppConfigModule, PrismaModule, RedisModule, HealthModule],
})
export class AppModule {}
