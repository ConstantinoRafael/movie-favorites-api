import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosHeaders } from 'axios';
import { getLoggerToken } from 'nestjs-pino';
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
  let favoriteRepository: {
    findAll: jest.Mock;
    findByTmdbId: jest.Mock;
    create: jest.Mock;
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
});
