import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosHeaders } from 'axios';
import { FavoriteRepository } from '../favorites/favorite.repository';
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
  let favoriteRepository: { findAll: jest.Mock };
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
    };

    redis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
    };

    tmdb = {
      searchMovies: jest.fn().mockResolvedValue(tmdbResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovieService,
        { provide: FavoriteRepository, useValue: favoriteRepository },
        { provide: RedisService, useValue: redis },
        { provide: TmdbService, useValue: tmdb },
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
});
