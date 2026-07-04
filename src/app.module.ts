import { Module } from '@nestjs/common';
import { AppConfigModule } from './config';
import { HealthModule } from './modules/health';
import { FavoritesModule } from './modules/favorites';
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';
import { TmdbModule } from './tmdb';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    TmdbModule,
    FavoritesModule,
    HealthModule,
  ],
})
export class AppModule {}
