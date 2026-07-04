import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config';
import { AppConfigService } from '../config/app-config.service';
import { TmdbService } from './tmdb.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => ({
        baseURL: appConfig.tmdbBaseUrl,
        timeout: 10_000,
      }),
    }),
  ],
  providers: [TmdbService],
  exports: [TmdbService],
})
export class TmdbModule {}
