import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { configureTmdbAxiosRetry } from './tmdb-retry.config';

@Injectable()
export class TmdbHttpRetrySetup implements OnModuleInit {
  constructor(
    private readonly httpService: HttpService,
    @InjectPinoLogger(TmdbHttpRetrySetup.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    configureTmdbAxiosRetry(this.httpService.axiosRef, this.logger);
  }
}
