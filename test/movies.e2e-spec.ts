import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { validationExceptionFactory } from '../src/common/pipes';
import { FavoriteRepository } from '../src/modules/favorites/favorite.repository';
import { PrismaService } from '../src/prisma';
import { RedisService } from '../src/redis';
import { TmdbService } from '../src/tmdb';

describe('Movies search (e2e)', () => {
  let app: INestApplication<App>;
  let redis: { get: jest.Mock; set: jest.Mock };
  let tmdb: { searchMovies: jest.Mock };

  const tmdbResponse = {
    page: 1,
    total_pages: 1,
    total_results: 1,
    results: [
      {
        id: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac...',
        poster_path: '/poster.jpg',
        release_date: '1999-10-15',
        vote_average: 8.4,
      },
    ],
  };

  beforeEach(async () => {
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    tmdb = {
      searchMovies: jest.fn().mockResolvedValue(tmdbResponse),
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
      .useValue({
        searchMovies: tmdb.searchMovies,
        getMovie: jest.fn(),
      })
      .overrideProvider(FavoriteRepository)
      .useValue({
        findAll: jest.fn().mockResolvedValue([]),
        findByTmdbId: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('/movies/search (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/movies/search')
      .query({ query: 'fight club', page: 1 })
      .expect(200);

    expect(response.body).toEqual({
      page: 1,
      totalPages: 1,
      totalResults: 1,
      results: [
        {
          tmdbId: 550,
          title: 'Fight Club',
          overview: 'A ticking-time-bomb insomniac...',
          posterPath: '/poster.jpg',
          releaseYear: 1999,
          voteAverage: 8.4,
          isFavorite: false,
        },
      ],
    });

    expect(tmdb.searchMovies).toHaveBeenCalledWith('fight club', 1);
    expect(redis.set).toHaveBeenCalled();
  });

  it('/movies/search (GET) should return 400 for invalid query', async () => {
    const response = await request(app.getHttpServer())
      .get('/movies/search')
      .query({ query: '' })
      .expect(400);

    const body = response.body as { statusCode: number; path: string };

    expect(body.statusCode).toBe(400);
    expect(body.path).toBe('/movies/search?query=');
  });
});
