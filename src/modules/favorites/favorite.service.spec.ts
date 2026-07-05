import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosHeaders } from 'axios';
import { getLoggerToken } from 'nestjs-pino';
import {
  MovieAlreadyFavoritedException,
  MovieNotFoundException,
  MovieNotWatchedException,
} from '@common/exceptions';
import { LogEvent } from '@common/logging';
import { RedisService } from '../../redis';
import { TmdbService, TmdbErrorHandler } from '../../tmdb';
import { TmdbCircuitOpenException } from '../../tmdb/tmdb-circuit-open.exception';
import { FavoriteRepository } from './favorite.repository';
import { FavoriteService } from './favorite.service';
import {
  buildFavoriteTmdbCacheKey,
  FAVORITE_TMDB_CACHE_TTL_SECONDS,
} from './favorites.constants';

describe('FavoriteService', () => {
  let service: FavoriteService;
  let favoriteRepository: {
    findAll: jest.Mock;
    findByTmdbId: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let redis: { get: jest.Mock; set: jest.Mock };
  let tmdb: { getMovie: jest.Mock };
  let logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

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

  const storedFavorite = {
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
    favoriteRepository = {
      findAll: jest.fn().mockResolvedValue([]),
      findByTmdbId: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    };

    redis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
    };

    tmdb = {
      getMovie: jest.fn(),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoriteService,
        TmdbErrorHandler,
        { provide: FavoriteRepository, useValue: favoriteRepository },
        { provide: RedisService, useValue: redis },
        { provide: TmdbService, useValue: tmdb },
        { provide: getLoggerToken(FavoriteService.name), useValue: logger },
        { provide: getLoggerToken(TmdbErrorHandler.name), useValue: logger },
      ],
    }).compile();

    service = module.get(FavoriteService);
  });

  describe('addFavorite', () => {
    it('should fetch from TMDB, persist snapshot, and return favorite', async () => {
      tmdb.getMovie.mockResolvedValue(tmdbMovieDetails);
      favoriteRepository.create.mockResolvedValue(storedFavorite);

      const result = await service.addFavorite({ tmdbId: 550 });

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
      expect(result).toMatchObject({ tmdbId: 550, watched: false });
    });

    it('should throw MovieAlreadyFavoritedException when duplicate', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(storedFavorite);

      await expect(service.addFavorite({ tmdbId: 550 })).rejects.toBeInstanceOf(
        MovieAlreadyFavoritedException,
      );

      expect(tmdb.getMovie).not.toHaveBeenCalled();
    });

    it('should throw MovieNotFoundException when TMDB returns 404', async () => {
      tmdb.getMovie.mockRejectedValue(createAxiosError(404, 'Not Found'));

      await expect(service.addFavorite({ tmdbId: 999 })).rejects.toBeInstanceOf(
        MovieNotFoundException,
      );
    });

    it('should throw BadGatewayException when TMDB fails with 502', async () => {
      tmdb.getMovie.mockRejectedValue(createAxiosError(502, 'Bad Gateway'));

      await expect(service.addFavorite({ tmdbId: 550 })).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });

  describe('markAsWatched', () => {
    const watchedFavorite = {
      ...storedFavorite,
      watched: true,
      watchedAt: new Date('2026-01-15T20:30:00.000Z'),
    };

    it('should mark favorite as watched', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(storedFavorite);
      favoriteRepository.update.mockResolvedValue(watchedFavorite);

      const result = await service.markAsWatched(550);

      expect(favoriteRepository.update).toHaveBeenCalledWith(550, {
        watched: true,
        watchedAt: expect.any(Date),
      });
      expect(result.watched).toBe(true);
    });

    it('should return existing favorite when already watched', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(watchedFavorite);

      const result = await service.markAsWatched(550);

      expect(favoriteRepository.update).not.toHaveBeenCalled();
      expect(result.watched).toBe(true);
    });

    it('should throw MovieNotFoundException when favorite does not exist', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(null);

      await expect(service.markAsWatched(999)).rejects.toBeInstanceOf(
        MovieNotFoundException,
      );
    });
  });

  describe('updateRating', () => {
    const watchedFavorite = {
      ...storedFavorite,
      watched: true,
      watchedAt: new Date('2026-01-15T20:30:00.000Z'),
      rating: 8.5,
    };

    it('should persist rating when favorite is watched', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue({
        ...watchedFavorite,
        rating: null,
      });
      favoriteRepository.update.mockResolvedValue(watchedFavorite);

      const result = await service.updateRating(550, { rating: 8.5 });

      expect(favoriteRepository.update).toHaveBeenCalledWith(550, { rating: 8.5 });
      expect(result.rating).toBe(8.5);
    });

    it('should throw MovieNotWatchedException when not watched', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(storedFavorite);

      await expect(
        service.updateRating(550, { rating: 8.5 }),
      ).rejects.toBeInstanceOf(MovieNotWatchedException);
    });

    it('should throw MovieNotFoundException when favorite does not exist', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(null);

      await expect(
        service.updateRating(999, { rating: 8.5 }),
      ).rejects.toBeInstanceOf(MovieNotFoundException);
    });
  });

  describe('listFavorites', () => {
    const localFavorite = {
      ...storedFavorite,
      title: 'Fight Club (local)',
      overview: 'Local overview...',
      voteAverage: 8.0,
    };

    const tmdbSnapshot = {
      title: 'Fight Club',
      overview: 'Updated overview from TMDB',
      releaseYear: 1999,
      posterPath: '/updated-poster.jpg',
      voteAverage: 8.8,
    };

    const enrichedTmdbDetails = {
      ...tmdbMovieDetails,
      overview: 'Updated overview from TMDB',
      poster_path: '/updated-poster.jpg',
      vote_average: 8.8,
    };

    beforeEach(() => {
      favoriteRepository.findAll.mockResolvedValue([localFavorite]);
    });

    it('should enrich from Redis cache on cache hit', async () => {
      redis.get.mockResolvedValue(JSON.stringify(tmdbSnapshot));

      const result = await service.listFavorites();

      expect(tmdb.getMovie).not.toHaveBeenCalled();
      expect(result[0]).toMatchObject({
        title: 'Fight Club',
        voteAverage: 8.8,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: LogEvent.CACHE_HIT, tmdbId: 550 }),
        'cache hit',
      );
    });

    it('should fetch from TMDB and cache on cache miss', async () => {
      redis.get.mockResolvedValue(null);
      tmdb.getMovie.mockResolvedValue(enrichedTmdbDetails);

      const result = await service.listFavorites();

      expect(tmdb.getMovie).toHaveBeenCalledWith(550);
      expect(redis.set).toHaveBeenCalledWith(
        buildFavoriteTmdbCacheKey(550),
        JSON.stringify(tmdbSnapshot),
        FAVORITE_TMDB_CACHE_TTL_SECONDS,
      );
      expect(result[0]?.voteAverage).toBe(8.8);
    });

    it('should fallback to local data when TMDB is unavailable', async () => {
      redis.get.mockResolvedValue(null);
      tmdb.getMovie.mockRejectedValue(createAxiosError(502, 'Bad Gateway'));

      const result = await service.listFavorites();

      expect(result[0]).toMatchObject({
        title: 'Fight Club (local)',
        voteAverage: 8.0,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.FALLBACK,
          tmdbId: 550,
          reason: 'tmdb_unavailable',
        }),
        'fallback',
      );
    });

    it('should fallback to local data when circuit breaker is open', async () => {
      redis.get.mockResolvedValue(null);
      tmdb.getMovie.mockRejectedValue(new TmdbCircuitOpenException());

      const result = await service.listFavorites();

      expect(result[0]?.title).toBe('Fight Club (local)');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: LogEvent.FALLBACK,
          tmdbId: 550,
          reason: 'circuit_open',
        }),
        'fallback',
      );
    });

    it('should return empty array when there are no favorites', async () => {
      favoriteRepository.findAll.mockResolvedValue([]);

      const result = await service.listFavorites();

      expect(result).toEqual([]);
    });
  });
});
