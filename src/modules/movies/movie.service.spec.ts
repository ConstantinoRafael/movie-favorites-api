import { BadGatewayException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosHeaders } from 'axios';
import { getLoggerToken } from 'nestjs-pino';
import {
  MovieAlreadyFavoritedException,
  MovieNotFoundException,
  MovieNotWatchedException,
} from '../../common/exceptions';
import { LogEvent } from '../../common/logging';
import { FavoriteRepository } from '../favorites/favorite.repository';
import {
  buildFavoriteTmdbCacheKey,
  FAVORITE_TMDB_CACHE_TTL_SECONDS,
} from '../favorites/favorites.constants';
import { RedisService } from '../../redis';
import { TmdbService } from '../../tmdb';
import { TmdbCircuitOpenException } from '../../tmdb/tmdb-circuit-open.exception';
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
      searchMovies: jest.fn().mockResolvedValue(tmdbSearchResponse),
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

  describe('addFavorite', () => {
    describe('favoritar corretamente', () => {
      it('deve buscar o filme no TMDB, persistir snapshot e retornar o favorito', async () => {
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
        expect(result).toMatchObject({
          id: 1,
          tmdbId: 550,
          title: 'Fight Club',
          watched: false,
        });
      });
    });

    describe('duplicidade', () => {
      it('deve lançar MovieAlreadyFavoritedException quando o filme já está favoritado', async () => {
        favoriteRepository.findByTmdbId.mockResolvedValue(storedFavorite);

        await expect(service.addFavorite({ tmdbId: 550 })).rejects.toBeInstanceOf(
          MovieAlreadyFavoritedException,
        );

        expect(tmdb.getMovie).not.toHaveBeenCalled();
        expect(favoriteRepository.create).not.toHaveBeenCalled();
      });
    });

    describe('filme inexistente', () => {
      it('deve lançar MovieNotFoundException quando o TMDB retorna 404', async () => {
        tmdb.getMovie.mockRejectedValue(createAxiosError(404, 'Not Found'));

        await expect(service.addFavorite({ tmdbId: 999 })).rejects.toBeInstanceOf(
          MovieNotFoundException,
        );

        expect(favoriteRepository.create).not.toHaveBeenCalled();
      });

      it('deve lançar BadGatewayException quando o TMDB falha com erro diferente de 404', async () => {
        tmdb.getMovie.mockRejectedValue(createAxiosError(502, 'Bad Gateway'));

        await expect(service.addFavorite({ tmdbId: 550 })).rejects.toBeInstanceOf(
          BadGatewayException,
        );

        expect(favoriteRepository.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('markAsWatched', () => {
    const watchedFavorite = {
      ...storedFavorite,
      watched: true,
      watchedAt: new Date('2026-01-15T20:30:00.000Z'),
    };

    describe('assistido', () => {
      it('deve marcar o favorito como assistido com watchedAt', async () => {
        favoriteRepository.findByTmdbId.mockResolvedValue(storedFavorite);
        favoriteRepository.update.mockResolvedValue(watchedFavorite);

        const result = await service.markAsWatched(550);

        expect(favoriteRepository.update).toHaveBeenCalledWith(550, {
          watched: true,
          watchedAt: expect.any(Date),
        });
        expect(result.watched).toBe(true);
        expect(result.watchedAt).toEqual(watchedFavorite.watchedAt);
      });

      it('deve retornar o favorito sem atualizar quando já está assistido (idempotente)', async () => {
        favoriteRepository.findByTmdbId.mockResolvedValue(watchedFavorite);

        const result = await service.markAsWatched(550);

        expect(favoriteRepository.update).not.toHaveBeenCalled();
        expect(result).toMatchObject({
          tmdbId: 550,
          watched: true,
          watchedAt: watchedFavorite.watchedAt,
        });
      });
    });

    it('deve lançar MovieNotFoundException quando o favorito não existe', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(null);

      await expect(service.markAsWatched(999)).rejects.toBeInstanceOf(
        MovieNotFoundException,
      );

      expect(favoriteRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateRating', () => {
    const watchedFavorite = {
      ...storedFavorite,
      watched: true,
      watchedAt: new Date('2026-01-15T20:30:00.000Z'),
      rating: 8.5,
    };

    describe('avaliação válida', () => {
      it('deve persistir a nota quando o filme já foi assistido', async () => {
        favoriteRepository.findByTmdbId.mockResolvedValue({
          ...watchedFavorite,
          rating: null,
        });
        favoriteRepository.update.mockResolvedValue(watchedFavorite);

        const result = await service.updateRating(550, { rating: 8.5 });

        expect(favoriteRepository.update).toHaveBeenCalledWith(550, {
          rating: 8.5,
        });
        expect(result.rating).toBe(8.5);
      });
    });

    describe('filme não assistido', () => {
      it('deve lançar MovieNotWatchedException quando o favorito ainda não foi assistido', async () => {
        favoriteRepository.findByTmdbId.mockResolvedValue(storedFavorite);

        await expect(
          service.updateRating(550, { rating: 8.5 }),
        ).rejects.toBeInstanceOf(MovieNotWatchedException);

        expect(favoriteRepository.update).not.toHaveBeenCalled();
      });
    });

    it('deve lançar MovieNotFoundException quando o favorito não existe', async () => {
      favoriteRepository.findByTmdbId.mockResolvedValue(null);

      await expect(
        service.updateRating(999, { rating: 8.5 }),
      ).rejects.toBeInstanceOf(MovieNotFoundException);

      expect(favoriteRepository.update).not.toHaveBeenCalled();
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

    it('deve enriquecer favoritos com dados do cache Redis (cache hit)', async () => {
      redis.get.mockResolvedValue(JSON.stringify(tmdbSnapshot));

      const result = await service.listFavorites();

      expect(redis.get).toHaveBeenCalledWith(buildFavoriteTmdbCacheKey(550));
      expect(tmdb.getMovie).not.toHaveBeenCalled();
      expect(result[0]).toMatchObject({
        tmdbId: 550,
        title: 'Fight Club',
        overview: 'Updated overview from TMDB',
        voteAverage: 8.8,
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: LogEvent.CACHE_HIT, tmdbId: 550 }),
        'cache hit',
      );
    });

    it('deve buscar no TMDB e cachear quando não há dados no Redis (cache miss)', async () => {
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
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: LogEvent.CACHE_MISS, tmdbId: 550 }),
        'cache miss',
      );
    });

    describe('fallback do TMDB', () => {
      it('deve retornar dados locais quando o TMDB está indisponível', async () => {
        redis.get.mockResolvedValue(null);
        tmdb.getMovie.mockRejectedValue(createAxiosError(502, 'Bad Gateway'));

        const result = await service.listFavorites();

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          title: 'Fight Club (local)',
          overview: 'Local overview...',
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

      it('deve retornar dados locais quando o circuit breaker do TMDB está aberto', async () => {
        redis.get.mockResolvedValue(null);
        tmdb.getMovie.mockRejectedValue(new TmdbCircuitOpenException());

        const result = await service.listFavorites();

        expect(result[0]).toMatchObject({
          title: 'Fight Club (local)',
          overview: 'Local overview...',
        });
        expect(logger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            event: LogEvent.FALLBACK,
            tmdbId: 550,
            reason: 'circuit_open',
          }),
          'fallback',
        );
      });

      it('deve buscar no TMDB quando a leitura do cache Redis falha', async () => {
        redis.get.mockRejectedValue(new Error('Redis unavailable'));
        tmdb.getMovie.mockResolvedValue(enrichedTmdbDetails);

        const result = await service.listFavorites();

        expect(tmdb.getMovie).toHaveBeenCalledWith(550);
        expect(result[0]?.voteAverage).toBe(8.8);
      });
    });

    it('deve retornar array vazio quando não há favoritos', async () => {
      favoriteRepository.findAll.mockResolvedValue([]);

      const result = await service.listFavorites();

      expect(result).toEqual([]);
      expect(redis.get).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('deve retornar resultado do cache e marcar isFavorite sem chamar o TMDB', async () => {
      redis.get.mockResolvedValue(JSON.stringify(simplifiedSearchResponse));

      const result = await service.search({ query: 'fight club', page: 1 });

      expect(redis.get).toHaveBeenCalledWith(
        buildMoviesSearchCacheKey('fight club', 1),
      );
      expect(tmdb.searchMovies).not.toHaveBeenCalled();
      expect(result.results[0]?.isFavorite).toBe(true);
    });

    it('deve buscar no TMDB e cachear em cache miss', async () => {
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

    it('deve lançar BadGatewayException quando o TMDB falha na busca', async () => {
      redis.get.mockResolvedValue(null);
      tmdb.searchMovies.mockRejectedValue(createAxiosError(502, 'Bad Gateway'));

      await expect(
        service.search({ query: 'fight club', page: 1 }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
