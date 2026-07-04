import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { ENV_KEYS } from './env.keys';
import { EnvironmentVariables } from './env.validation';

const mockEnvironment: EnvironmentVariables = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  TMDB_API_KEY: 'test-api-key',
  TMDB_BASE_URL: 'https://api.themoviedb.org/3',
  REDIS_URL: 'redis://localhost:6379',
  APP_PORT: 3000,
};

describe('AppConfigService', () => {
  let service: AppConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: keyof EnvironmentVariables) => mockEnvironment[key],
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
  });

  it('should expose databaseUrl', () => {
    expect(service.databaseUrl).toBe(mockEnvironment[ENV_KEYS.DATABASE_URL]);
  });

  it('should expose tmdbApiKey', () => {
    expect(service.tmdbApiKey).toBe(mockEnvironment[ENV_KEYS.TMDB_API_KEY]);
  });

  it('should expose tmdbBaseUrl', () => {
    expect(service.tmdbBaseUrl).toBe(mockEnvironment[ENV_KEYS.TMDB_BASE_URL]);
  });

  it('should expose redisUrl', () => {
    expect(service.redisUrl).toBe(mockEnvironment[ENV_KEYS.REDIS_URL]);
  });

  it('should expose appPort', () => {
    expect(service.appPort).toBe(mockEnvironment[ENV_KEYS.APP_PORT]);
  });
});
