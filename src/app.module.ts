import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config';
import { HealthModule } from './modules/health';
import { FavoritesModule } from './modules/favorites';
import { MoviesModule } from './modules/movies';
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';
import { TmdbModule } from './tmdb';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: true,
        customProps: () => ({ context: 'HTTP' }),
      },
    }),
    AppConfigModule,
    PrismaModule,
    RedisModule,
    TmdbModule,
    FavoritesModule,
    MoviesModule,
    HealthModule,
  ],
})
export class AppModule {}
