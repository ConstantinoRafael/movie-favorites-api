import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  createIntegrationApp,
  expectApiError,
  IntegrationMocks,
} from './helpers/integration-app';
import {
  createdFavorite,
  tmdbMovieDetails,
  watchedFavorite,
} from './helpers/favorites.fixture';

describe('Favorites API (integração)', () => {
  let app: INestApplication<App>;
  let mocks: IntegrationMocks;

  const createAxiosError = (status: number, message: string): AxiosError => {
    const error = new AxiosError(message);
    error.response = {
      status,
      statusText: message,
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    };

    return error;
  };

  beforeEach(async () => {
    const testApp = await createIntegrationApp();
    app = testApp.app;
    mocks = testApp.mocks;

    mocks.tmdb.getMovie.mockResolvedValue(tmdbMovieDetails);
    mocks.favoriteRepository.create.mockResolvedValue(createdFavorite);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /favorites', () => {
    it('deve retornar 201 com o favorito criado', async () => {
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
        rating: null,
      });

      expect(mocks.favoriteRepository.findByTmdbId).toHaveBeenCalledWith(550);
      expect(mocks.tmdb.getMovie).toHaveBeenCalledWith(550);
      expect(mocks.favoriteRepository.create).toHaveBeenCalledWith({
        tmdbId: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac...',
        releaseYear: 1999,
        posterPath: '/poster.jpg',
        voteAverage: 8.4,
      });
    });

    it('deve retornar 409 quando o filme já está favoritado', async () => {
      mocks.favoriteRepository.findByTmdbId.mockResolvedValue(createdFavorite);

      const response = await request(app.getHttpServer())
        .post('/favorites')
        .send({ tmdbId: 550 })
        .expect(409);

      expectApiError(response.body, {
        statusCode: 409,
        message: 'Movie is already in favorites',
        path: '/favorites',
      });
      expect(mocks.tmdb.getMovie).not.toHaveBeenCalled();
      expect(mocks.favoriteRepository.create).not.toHaveBeenCalled();
    });

    it('deve retornar 404 quando o filme não existe no TMDB', async () => {
      mocks.tmdb.getMovie.mockRejectedValue(createAxiosError(404, 'Not Found'));

      const response = await request(app.getHttpServer())
        .post('/favorites')
        .send({ tmdbId: 999 })
        .expect(404);

      expectApiError(response.body, {
        statusCode: 404,
        message: 'Movie with TMDB id 999 not found',
        path: '/favorites',
      });
      expect(mocks.favoriteRepository.create).not.toHaveBeenCalled();
    });

    it('deve retornar 502 quando o TMDB está indisponível', async () => {
      mocks.tmdb.getMovie.mockRejectedValue(createAxiosError(502, 'Bad Gateway'));

      const response = await request(app.getHttpServer())
        .post('/favorites')
        .send({ tmdbId: 550 })
        .expect(502);

      expectApiError(response.body, {
        statusCode: 502,
        message: 'Failed to fetch movie from TMDB',
        path: '/favorites',
      });
    });

    it('deve retornar 400 quando o body é inválido', async () => {
      const response = await request(app.getHttpServer())
        .post('/favorites')
        .send({ tmdbId: 0 })
        .expect(400);

      expectApiError(response.body, {
        statusCode: 400,
        path: '/favorites',
      });
      expect(mocks.tmdb.getMovie).not.toHaveBeenCalled();
    });
  });

  describe('GET /favorites', () => {
    it('deve retornar 200 com favoritos enriquecidos pelo TMDB', async () => {
      mocks.favoriteRepository.findAll.mockResolvedValue([createdFavorite]);

      const response = await request(app.getHttpServer())
        .get('/favorites')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toMatchObject({
        id: 1,
        tmdbId: 550,
        title: 'Fight Club',
        overview: 'A ticking-time-bomb insomniac...',
        voteAverage: 8.4,
        watched: false,
      });
      expect(mocks.tmdb.getMovie).toHaveBeenCalledWith(550);
      expect(mocks.redis.set).toHaveBeenCalled();
    });

    it('deve retornar 200 usando dados do cache Redis', async () => {
      mocks.favoriteRepository.findAll.mockResolvedValue([createdFavorite]);
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          title: 'Fight Club (cached)',
          overview: 'Cached overview',
          releaseYear: 1999,
          posterPath: '/cached-poster.jpg',
          voteAverage: 9.0,
        }),
      );

      const response = await request(app.getHttpServer())
        .get('/favorites')
        .expect(200);

      expect(response.body[0]).toMatchObject({
        title: 'Fight Club (cached)',
        voteAverage: 9.0,
      });
      expect(mocks.tmdb.getMovie).not.toHaveBeenCalled();
    });

    it('deve retornar 200 com dados locais quando o TMDB falha (fallback)', async () => {
      const localFavorite = {
        ...createdFavorite,
        title: 'Fight Club (local)',
        voteAverage: 7.5,
      };

      mocks.favoriteRepository.findAll.mockResolvedValue([localFavorite]);
      mocks.tmdb.getMovie.mockRejectedValue(createAxiosError(502, 'Bad Gateway'));

      const response = await request(app.getHttpServer())
        .get('/favorites')
        .expect(200);

      expect(response.body[0]).toMatchObject({
        title: 'Fight Club (local)',
        voteAverage: 7.5,
      });
    });

    it('deve retornar 200 com array vazio quando não há favoritos', async () => {
      mocks.favoriteRepository.findAll.mockResolvedValue([]);

      const response = await request(app.getHttpServer())
        .get('/favorites')
        .expect(200);

      expect(response.body).toEqual([]);
      expect(mocks.tmdb.getMovie).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /favorites/:tmdbId/watch', () => {
    it('deve retornar 200 ao marcar favorito como assistido', async () => {
      mocks.favoriteRepository.findByTmdbId.mockResolvedValue(createdFavorite);
      mocks.favoriteRepository.update.mockResolvedValue(watchedFavorite);

      const response = await request(app.getHttpServer())
        .patch('/favorites/550/watch')
        .expect(200);

      expect(response.body).toMatchObject({
        tmdbId: 550,
        watched: true,
        rating: 8.5,
      });
      expect(mocks.favoriteRepository.update).toHaveBeenCalledWith(550, {
        watched: true,
        watchedAt: expect.any(Date),
      });
    });

    it('deve retornar 200 sem atualizar quando já está assistido', async () => {
      mocks.favoriteRepository.findByTmdbId.mockResolvedValue(watchedFavorite);

      const response = await request(app.getHttpServer())
        .patch('/favorites/550/watch')
        .expect(200);

      expect(response.body.watched).toBe(true);
      expect(mocks.favoriteRepository.update).not.toHaveBeenCalled();
    });

    it('deve retornar 404 quando o favorito não existe', async () => {
      mocks.favoriteRepository.findByTmdbId.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .patch('/favorites/999/watch')
        .expect(404);

      expectApiError(response.body, {
        statusCode: 404,
        message: 'Favorite with TMDB id 999 not found',
        path: '/favorites/999/watch',
      });
      expect(mocks.favoriteRepository.update).not.toHaveBeenCalled();
    });

    it('deve retornar 400 quando tmdbId é inválido', async () => {
      const response = await request(app.getHttpServer())
        .patch('/favorites/0/watch')
        .expect(400);

      expectApiError(response.body, {
        statusCode: 400,
        path: '/favorites/0/watch',
      });
    });
  });

  describe('PATCH /favorites/:tmdbId/rating', () => {
    it('deve retornar 200 ao avaliar favorito assistido', async () => {
      mocks.favoriteRepository.findByTmdbId.mockResolvedValue({
        ...watchedFavorite,
        rating: null,
      });
      mocks.favoriteRepository.update.mockResolvedValue(watchedFavorite);

      const response = await request(app.getHttpServer())
        .patch('/favorites/550/rating')
        .send({ rating: 8.5 })
        .expect(200);

      expect(response.body).toMatchObject({
        tmdbId: 550,
        watched: true,
        rating: 8.5,
      });
      expect(mocks.favoriteRepository.update).toHaveBeenCalledWith(550, {
        rating: 8.5,
      });
    });

    it('deve retornar 400 quando o filme não foi assistido', async () => {
      mocks.favoriteRepository.findByTmdbId.mockResolvedValue(createdFavorite);

      const response = await request(app.getHttpServer())
        .patch('/favorites/550/rating')
        .send({ rating: 8.5 })
        .expect(400);

      expectApiError(response.body, {
        statusCode: 400,
        message: 'Favorite must be marked as watched before rating',
        path: '/favorites/550/rating',
      });
      expect(mocks.favoriteRepository.update).not.toHaveBeenCalled();
    });

    it('deve retornar 404 quando o favorito não existe', async () => {
      mocks.favoriteRepository.findByTmdbId.mockResolvedValue(null);

      const response = await request(app.getHttpServer())
        .patch('/favorites/999/rating')
        .send({ rating: 8.5 })
        .expect(404);

      expectApiError(response.body, {
        statusCode: 404,
        message: 'Favorite with TMDB id 999 not found',
        path: '/favorites/999/rating',
      });
    });

    it('deve retornar 400 quando a nota é inválida', async () => {
      const response = await request(app.getHttpServer())
        .patch('/favorites/550/rating')
        .send({ rating: 11 })
        .expect(400);

      expectApiError(response.body, {
        statusCode: 400,
        path: '/favorites/550/rating',
      });
      expect(mocks.favoriteRepository.findByTmdbId).not.toHaveBeenCalled();
    });
  });
});
