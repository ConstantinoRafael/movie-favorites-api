import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosHeaders } from 'axios';
import { getLoggerToken } from 'nestjs-pino';
import { FavoriteRepository } from '../favorites/favorite.repository';
import {
  buildFavoriteTmdbCacheKey,
  FAVORITE_TMDB_CACHE_TTL_SECONDS,
} from '../favorites/favorites.constants';
import { RedisService } from '../../redis';
import { TmdbService } from '../../tmdb';
import { SearchMoviesResponseDto } from './dto/search-movies-response.dto';
import {
  buildMoviesSearchCacheKey,
  MOVIES_SEARCH_CACHE_TTL_SECONDS,
} from './movies.constants';
import { MovieService } from './movie.service';

describe('MovieService', () => {
  let service: MovieService;
  let favoriteRepository: {
    findAll: jest.Mock;
    findByTmdbId: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let redis: { get: jest.Mock; set: jest.Mock };
  let tmdb: { searchMovies: jest.Mock; getMovie: jest.Mock };
  let logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

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

  const simplifiedResponse: SearchMoviesResponseDto = {
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
      },
    ],
  };

  beforeEach(async () => {
    favoriteRepository = {
      findAll: jest.fn().mockResolvedValue([{ tmdbId: 550 }]),
      findByTmdbId: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    };

    redis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
    };

    tmdb = {
      searchMovies: jest.fn().mockResolvedValue(tmdbResponse),
      getMovie: jest.fn(),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovieService,
        { provide: FavoriteRepository, useValue: favoriteRepository },
        { provide: RedisService, useValue: redis },
        { provide: TmdbService, useValue: tmdb },
        { provide: getLoggerToken(MovieService.name), useValue: logger },
      ],
    }).compile();

    service = module.get<MovieService>(MovieService);
  });

  it('should return cached response on cache hit', async () => {
    redis.get.mockResolvedValue(JSON.stringify(simplifiedResponse));

    const result = await service.search({ query: 'fight club', page: 1 });

    expect(redis.get).toHaveBeenCalledWith(
      buildMoviesSearchCacheKey('fight club', 1),
    );
    expect(tmdb.searchMovies).not.toHaveBeenCalled();
    expect(result.results[0]?.isFavorite).toBe(true);
  });

  it('should fetch from TMDB and cache on cache miss', async () => {
    redis.get.mockResolvedValue(null);

    const result = await service.search({ query: 'fight club', page: 1 });

    expect(tmdb.searchMovies).toHaveBeenCalledWith('fight club', 1);
    expect(redis.set).toHaveBeenCalledWith(
      buildMoviesSearchCacheKey('fight club', 1),
      JSON.stringify(simplifiedResponse),
      MOVIES_SEARCH_CACHE_TTL_SECONDS,
    );
    expect(result).toEqual({
      ...simplifiedResponse,
      results: [{ ...simplifiedResponse.results[0], isFavorite: true }],
    });
  });

  it('should throw BadGatewayException when TMDB fails', async () => {
    redis.get.mockResolvedValue(null);

    const axiosError = new AxiosError('Request failed');
    axiosError.response = {
      status: 502,
      statusText: 'Bad Gateway',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: {},
    };

    tmdb.searchMovies.mockRejectedValue(axiosError);

    await expect(
      service.search({ query: 'fight club', page: 1 }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('should fallback to TMDB when cache read fails', async () => {
    redis.get.mockRejectedValue(new Error('Redis unavailable'));

    const result = await service.search({ query: 'fight club', page: 1 });

    expect(tmdb.searchMovies).toHaveBeenCalledWith('fight club', 1);
    expect(result.results[0]?.tmdbId).toBe(550);
  });

  describe('addFavorite', () => {
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

    it('should create a favorite when movie exists in TMDB', async () => {
      tmdb.getMovie.mockResolvedValue(tmdbMovieDetails);
      favoriteRepository.create.mockResolvedValue(createdFavorite);

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
      expect(result.tmdbId).toBe(550);
    });

    it('should throw ConflictException when movie is already favorited', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(createdFavorite);

      await expect(service.addFavorite({ tmdbId: 550 })).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(tmdb.getMovie).not.toHaveBeenCalled();
      expect(favoriteRepository.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when TMDB returns 404', async () => {
      const axiosError = new AxiosError('Not Found');
      axiosError.response = {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {},
      };

      tmdb.getMovie.mockRejectedValue(axiosError);

      await expect(service.addFavorite({ tmdbId: 999 })).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(favoriteRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadGatewayException when TMDB fails with other errors', async () => {
      const axiosError = new AxiosError('Bad Gateway');
      axiosError.response = {
        status: 502,
        statusText: 'Bad Gateway',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {},
      };

      tmdb.getMovie.mockRejectedValue(axiosError);

      await expect(service.addFavorite({ tmdbId: 550 })).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });
  });

  describe('markAsWatched', () => {
    const unwatchedFavorite = {
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

    const watchedFavorite = {
      ...unwatchedFavorite,
      watched: true,
      watchedAt: new Date('2026-01-15T20:30:00.000Z'),
    };

    it('should mark favorite as watched', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(unwatchedFavorite);
      favoriteRepository.update.mockResolvedValue(watchedFavorite);

      const result = await service.markAsWatched(550);

      expect(favoriteRepository.update).toHaveBeenCalledWith(550, {
        watched: true,
        watchedAt: expect.any(Date),
      });
      expect(result.watched).toBe(true);
      expect(result.watchedAt).toEqual(watchedFavorite.watchedAt);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 550 }),
        'Favorite marked as watched',
      );
    });

    it('should return existing favorite when already watched', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(watchedFavorite);

      const result = await service.markAsWatched(550);

      expect(favoriteRepository.update).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        tmdbId: 550,
        watched: true,
        watchedAt: watchedFavorite.watchedAt,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 550 }),
        'Favorite is already marked as watched',
      );
    });

    it('should throw NotFoundException when favorite does not exist', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(null);

      await expect(service.markAsWatched(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(favoriteRepository.update).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 999 }),
        'Favorite not found',
      );
    });
  });

  describe('listFavorites', () => {
    const storedFavorite = {
      id: 1,
      tmdbId: 550,
      title: 'Fight Club (local)',
      overview: 'Local overview...',
      releaseYear: 1999,
      posterPath: '/local-poster.jpg',
      voteAverage: 8.0,
      watched: false,
      watchedAt: null,
      rating: null,
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
      updatedAt: new Date('2026-01-01T12:00:00.000Z'),
    };

    const tmdbSnapshot = {
      title: 'Fight Club',
      overview: 'Updated overview from TMDB',
      releaseYear: 1999,
      posterPath: '/updated-poster.jpg',
      voteAverage: 8.8,
    };

    const tmdbMovieDetails = {
      id: 550,
      title: 'Fight Club',
      overview: 'Updated overview from TMDB',
      poster_path: '/updated-poster.jpg',
      release_date: '1999-10-15',
      vote_average: 8.8,
      runtime: 139,
      genres: [{ id: 18, name: 'Drama' }],
      status: 'Released',
    };

    beforeEach(() => {
      favoriteRepository.findAll.mockResolvedValue([storedFavorite]);
    });

    it('should return enriched favorites from cache on cache hit', async () => {
      redis.get.mockResolvedValue(JSON.stringify(tmdbSnapshot));

      const result = await service.listFavorites();

      expect(redis.get).toHaveBeenCalledWith(buildFavoriteTmdbCacheKey(550));
      expect(tmdb.getMovie).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        tmdbId: 550,
        title: 'Fight Club',
        overview: 'Updated overview from TMDB',
        voteAverage: 8.8,
        watched: false,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 550 }),
        'Cache hit for favorite TMDB data',
      );
    });

    it('should fetch from TMDB and cache on cache miss', async () => {
      redis.get.mockResolvedValue(null);
      tmdb.getMovie.mockResolvedValue(tmdbMovieDetails);

      const result = await service.listFavorites();

      expect(tmdb.getMovie).toHaveBeenCalledWith(550);
      expect(redis.set).toHaveBeenCalledWith(
        buildFavoriteTmdbCacheKey(550),
        JSON.stringify(tmdbSnapshot),
        FAVORITE_TMDB_CACHE_TTL_SECONDS,
      );
      expect(result[0]?.voteAverage).toBe(8.8);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 550 }),
        'Cache miss for favorite TMDB data',
      );
    });

    it('should fallback to local data when TMDB is unavailable', async () => {
      redis.get.mockResolvedValue(null);

      const axiosError = new AxiosError('Bad Gateway');
      axiosError.response = {
        status: 502,
        statusText: 'Bad Gateway',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {},
      };

      tmdb.getMovie.mockRejectedValue(axiosError);

      const result = await service.listFavorites();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: 'Fight Club (local)',
        overview: 'Local overview...',
        voteAverage: 8.0,
      });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ tmdbId: 550 }),
        'TMDB unavailable, using local fallback for favorite',
      );
    });

    it('should log response time after listing favorites', async () => {
      redis.get.mockResolvedValue(JSON.stringify(tmdbSnapshot));

      await service.listFavorites();

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1, responseTimeMs: expect.any(Number) }),
        'Favorites listed',
      );
    });

    it('should return empty array when there are no favorites', async () => {
      favoriteRepository.findAll.mockResolvedValue([]);

      const result = await service.listFavorites();

      expect(result).toEqual([]);
      expect(redis.get).not.toHaveBeenCalled();
    });
  });
});
