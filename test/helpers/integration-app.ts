import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { validationExceptionFactory } from '../../src/common/pipes';
import { FavoriteRepository } from '../../src/modules/favorites/favorite.repository';
import { PrismaService } from '../../src/prisma';
import { RedisService } from '../../src/redis';
import { TmdbService } from '../../src/tmdb';

export type FavoriteRepositoryMock = {
  findAll: jest.Mock;
  findByTmdbId: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

export type RedisMock = {
  get: jest.Mock;
  set: jest.Mock;
};

export type TmdbMock = {
  getMovie: jest.Mock;
  searchMovies: jest.Mock;
};

export type IntegrationMocks = {
  favoriteRepository: FavoriteRepositoryMock;
  redis: RedisMock;
  tmdb: TmdbMock;
};

export async function createIntegrationApp(): Promise<{
  app: INestApplication<App>;
  mocks: IntegrationMocks;
}> {
  const favoriteRepository: FavoriteRepositoryMock = {
    findAll: jest.fn().mockResolvedValue([]),
    findByTmdbId: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
  };

  const redis: RedisMock = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const tmdb: TmdbMock = {
    getMovie: jest.fn(),
    searchMovies: jest.fn(),
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(RedisService)
    .useValue({
      onModuleInit: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
      get: redis.get,
      set: redis.set,
      delete: jest.fn().mockResolvedValue(undefined),
    })
    .overrideProvider(TmdbService)
    .useValue(tmdb)
    .overrideProvider(FavoriteRepository)
    .useValue(favoriteRepository)
    .compile();

  const app = moduleFixture.createNestApplication({ bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  await app.init();

  return {
    app,
    mocks: { favoriteRepository, redis, tmdb },
  };
}

export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
};

export function expectApiError(
  body: unknown,
  expected: {
    statusCode: number;
    message?: string | string[];
    path?: string;
  },
): void {
  const errorBody = body as ApiErrorBody;

  expect(errorBody.statusCode).toBe(expected.statusCode);
  expect(errorBody.timestamp).toEqual(expect.any(String));
  expect(errorBody.path).toBe(expected.path ?? expect.any(String));

  if (expected.message !== undefined) {
    expect(errorBody.message).toEqual(expected.message);
  }
}
