import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AxiosError, AxiosHeaders } from 'axios';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters';
import { FavoriteRepository } from '../src/modules/favorites/favorite.repository';
import { PrismaService } from '../src/prisma';
import { RedisService } from '../src/redis';
import { TmdbService } from '../src/tmdb';

describe('Favorites (e2e)', () => {
  let app: INestApplication<App>;
  let favoriteRepository: {
    findAll: jest.Mock;
    findByTmdbId: jest.Mock;
    create: jest.Mock;
  };
  let redis: { get: jest.Mock; set: jest.Mock };
  let tmdb: { getMovie: jest.Mock };

  const tmdbMovieDetails = {
    id: 550,
    title: 'Fight Club',
    overview: 'A ticking-time-bomb insomniac...',
    poster_path: '/poster.jpg',
    release_date: '1999-10-15',
    vote_average: 8.4,
    runtime: 139,
    genres: [{ id: 18, name: 'Drama' }],
    status: 'Released',
  };

  const createdFavorite = {
    id: 1,
    tmdbId: 550,
    title: 'Fight Club',
    overview: 'A ticking-time-bomb insomniac...',
    releaseYear: 1999,
    posterPath: '/poster.jpg',
    voteAverage: 8.4,
    watched: false,
    watchedAt: null,
    rating: null,
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    updatedAt: new Date('2026-01-01T12:00:00.000Z'),
  };

  beforeEach(async () => {
    favoriteRepository = {
      findAll: jest.fn().mockResolvedValue([]),
      findByTmdbId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(createdFavorite),
    };

    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    tmdb = {
      getMovie: jest.fn().mockResolvedValue(tmdbMovieDetails),
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
        searchMovies: jest.fn(),
        getMovie: tmdb.getMovie,
      })
      .overrideProvider(FavoriteRepository)
      .useValue({
        findAll: favoriteRepository.findAll,
        findByTmdbId: favoriteRepository.findByTmdbId,
        create: favoriteRepository.create,
        update: jest.fn(),
        delete: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/favorites (GET) should return enriched favorites from TMDB', async () => {
    favoriteRepository.findAll.mockResolvedValue([createdFavorite]);

    const response = await request(app.getHttpServer()).get('/favorites').expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      id: 1,
      tmdbId: 550,
      title: 'Fight Club',
      overview: 'A ticking-time-bomb insomniac...',
      voteAverage: 8.4,
      watched: false,
    });

    expect(tmdb.getMovie).toHaveBeenCalledWith(550);
    expect(redis.set).toHaveBeenCalled();
  });

  it('/favorites (GET) should use cache when available', async () => {
    favoriteRepository.findAll.mockResolvedValue([createdFavorite]);

    const cachedSnapshot = {
      title: 'Fight Club (cached)',
      overview: 'Cached overview',
      releaseYear: 1999,
      posterPath: '/cached-poster.jpg',
      voteAverage: 9.0,
    };

    redis.get.mockResolvedValue(JSON.stringify(cachedSnapshot));

    const response = await request(app.getHttpServer()).get('/favorites').expect(200);

    expect(response.body[0]).toMatchObject({
      title: 'Fight Club (cached)',
      voteAverage: 9.0,
    });
    expect(tmdb.getMovie).not.toHaveBeenCalled();
  });

  it('/favorites (GET) should fallback to local data when TMDB fails', async () => {
    const localFavorite = {
      ...createdFavorite,
      title: 'Fight Club (local)',
      voteAverage: 7.5,
    };

    favoriteRepository.findAll.mockResolvedValue([localFavorite]);

    const axiosError = new AxiosError('Bad Gateway');
    axiosError.response = {
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    };

    tmdb.getMovie.mockRejectedValue(axiosError);

    const response = await request(app.getHttpServer()).get('/favorites').expect(200);

    expect(response.body[0]).toMatchObject({
      title: 'Fight Club (local)',
      voteAverage: 7.5,
    });
  });

  it('/favorites (POST) should create a favorite', async () => {
    const response = await request(app.getHttpServer())
      .post('/favorites')
      .send({ tmdbId: 550 })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 1,
      tmdbId: 550,
      title: 'Fight Club',
      overview: 'A ticking-time-bomb insomniac...',
      releaseYear: 1999,
      posterPath: '/poster.jpg',
      voteAverage: 8.4,
      watched: false,
    });

    expect(favoriteRepository.findByTmdbId).toHaveBeenCalledWith(550);
    expect(tmdb.getMovie).toHaveBeenCalledWith(550);
    expect(favoriteRepository.create).toHaveBeenCalledWith({
      tmdbId: 550,
      title: 'Fight Club',
      overview: 'A ticking-time-bomb insomniac...',
      releaseYear: 1999,
      posterPath: '/poster.jpg',
      voteAverage: 8.4,
    });
  });

  it('/favorites (POST) should return 409 when movie is already favorited', async () => {
    favoriteRepository.findByTmdbId.mockResolvedValue(createdFavorite);

    const response = await request(app.getHttpServer())
      .post('/favorites')
      .send({ tmdbId: 550 })
      .expect(409);

    const body = response.body as { statusCode: number; message: string };

    expect(body.statusCode).toBe(409);
    expect(body.message).toBe('Movie is already in favorites');
    expect(tmdb.getMovie).not.toHaveBeenCalled();
  });

  it('/favorites (POST) should return 404 when TMDB movie is not found', async () => {
    const axiosError = new AxiosError('Not Found');
    axiosError.response = {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    };

    tmdb.getMovie.mockRejectedValue(axiosError);

    const response = await request(app.getHttpServer())
      .post('/favorites')
      .send({ tmdbId: 999 })
      .expect(404);

    const body = response.body as { statusCode: number; message: string };

    expect(body.statusCode).toBe(404);
    expect(body.message).toBe('Movie with TMDB id 999 not found');
  });

  it('/favorites (POST) should return 400 for invalid body', async () => {
    const response = await request(app.getHttpServer())
      .post('/favorites')
      .send({ tmdbId: 0 })
      .expect(400);

    const body = response.body as { statusCode: number; path: string };

    expect(body.statusCode).toBe(400);
    expect(body.path).toBe('/favorites');
  });
});
