import { Module } from '@nestjs/common';
import { AppConfigModule } from './config';
import { HealthModule } from './modules/health';
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';
import { TmdbModule } from './tmdb';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    TmdbModule,
    HealthModule,
  ],
})
export class AppModule {}
