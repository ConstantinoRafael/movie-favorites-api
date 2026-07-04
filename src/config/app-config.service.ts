import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_KEYS } from './env.keys';
import { EnvironmentVariables } from './env.validation';

@Injectable()
export class AppConfigService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  get databaseUrl(): string {
    return this.configService.get(ENV_KEYS.DATABASE_URL, { infer: true });
  }

  get tmdbApiKey(): string {
    return this.configService.get(ENV_KEYS.TMDB_API_KEY, { infer: true });
  }

  get tmdbBaseUrl(): string {
    return this.configService.get(ENV_KEYS.TMDB_BASE_URL, { infer: true });
  }

  get redisUrl(): string {
    return this.configService.get(ENV_KEYS.REDIS_URL, { infer: true });
  }

  get appPort(): number {
    return this.configService.get(ENV_KEYS.APP_PORT, { infer: true });
  }
}
