import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigModule } from '../config';
import { AppConfigService } from '../config/app-config.service';
import { TmdbHttpRetrySetup } from './tmdb-http-retry.setup';
import { TmdbCircuitBreaker } from './tmdb-circuit-breaker';
import { TmdbErrorHandler } from './tmdb-error.handler';
import { TmdbService } from './tmdb.service';

@Module({
  imports: [
    LoggerModule,
    HttpModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => ({
        baseURL: appConfig.tmdbBaseUrl,
        timeout: 10_000,
      }),
    }),
  ],
  providers: [
    TmdbCircuitBreaker,
    TmdbErrorHandler,
    TmdbService,
    TmdbHttpRetrySetup,
  ],
  exports: [TmdbService, TmdbErrorHandler],
})
export class TmdbModule {}
