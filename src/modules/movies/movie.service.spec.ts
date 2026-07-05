import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosHeaders } from 'axios';
import { getLoggerToken } from 'nestjs-pino';
import { FavoriteRepository } from '../favorites/favorite.repository';
import { RedisService } from '../../redis';
import { TmdbService, TmdbErrorHandler } from '../../tmdb';
import { SearchMoviesResponseDto } from './dto/search-movies-response.dto';
import {
  buildMoviesSearchCacheKey,
  MOVIES_SEARCH_CACHE_TTL_SECONDS,
} from './movies.constants';
import { MovieService } from './movie.service';

describe('MovieService', () => {
  let service: MovieService;
  let favoriteRepository: { findAll: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock };
  let tmdb: { searchMovies: jest.Mock };
  let logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };

  const tmdbSearchResponse = {
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

  const simplifiedSearchResponse: SearchMoviesResponseDto = {
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
      findAll: jest.fn().mockResolvedValue([{ tmdbId: 550 }]),
    };

    redis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
    };

    tmdb = {
      searchMovies: jest.fn().mockResolvedValue(tmdbSearchResponse),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovieService,
        TmdbErrorHandler,
        { provide: FavoriteRepository, useValue: favoriteRepository },
        { provide: RedisService, useValue: redis },
        { provide: TmdbService, useValue: tmdb },
        { provide: getLoggerToken(MovieService.name), useValue: logger },
        { provide: getLoggerToken(TmdbErrorHandler.name), useValue: logger },
      ],
    }).compile();

    service = module.get(MovieService);
  });

  describe('search', () => {
    it('should return cached response and mark isFavorite without calling TMDB', async () => {
      redis.get.mockResolvedValue(JSON.stringify(simplifiedSearchResponse));

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
        JSON.stringify(simplifiedSearchResponse),
        MOVIES_SEARCH_CACHE_TTL_SECONDS,
      );
      expect(result.results[0]?.isFavorite).toBe(true);
    });

    it('should fallback to TMDB when cache read fails', async () => {
      redis.get.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.search({ query: 'fight club', page: 1 });

      expect(tmdb.searchMovies).toHaveBeenCalledWith('fight club', 1);
      expect(result.results[0]?.tmdbId).toBe(550);
    });

    it('should throw BadGatewayException when TMDB fails', async () => {
      redis.get.mockResolvedValue(null);
      tmdb.searchMovies.mockRejectedValue(createAxiosError(502, 'Bad Gateway'));

      await expect(
        service.search({ query: 'fight club', page: 1 }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
