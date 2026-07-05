import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from './config';
import { HttpExceptionFilter } from './common/filters';
import { HttpLoggingInterceptor } from './common/interceptors';
import { buildPinoParams } from './common/logging';
import { HealthModule } from './modules/health';
import { FavoritesModule } from './modules/favorites';
import { MoviesModule } from './modules/movies';
import { PrismaModule } from './prisma';
import { RedisModule } from './redis';
import { TmdbModule } from './tmdb';

@Module({
  imports: [
    LoggerModule.forRoot(buildPinoParams()),
    AppConfigModule,
    PrismaModule,
    RedisModule,
    TmdbModule,
    FavoritesModule,
    MoviesModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
  ],
})
export class AppModule {}
