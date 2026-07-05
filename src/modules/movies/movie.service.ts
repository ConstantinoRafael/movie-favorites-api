import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FavoriteMovie } from '@prisma/client';
import { AxiosError } from 'axios';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  MovieAlreadyFavoritedException,
  MovieNotFoundException,
  MovieNotWatchedException,
} from '../../common/exceptions';
import { LogEvent } from '../../common/logging';
import { CreateFavoriteDto } from '../favorites/dto/create-favorite.dto';
import { FavoriteMovieResponseDto } from '../favorites/dto/favorite-movie-response.dto';
import { UpdateFavoriteRatingDto } from '../favorites/dto/update-favorite-rating.dto';
import { FavoriteRepository } from '../favorites/favorite.repository';
import {
  buildFavoriteTmdbCacheKey,
  FAVORITE_TMDB_CACHE_TTL_SECONDS,
} from '../favorites/favorites.constants';
import {
  mapFavoriteToResponse,
  mapTmdbMovieToFavoriteSnapshot,
  mapTmdbMovieToSnapshot,
  mergeFavoriteWithTmdbSnapshot,
  TmdbMovieSnapshot,
} from '../favorites/mappers/favorite-movie.mapper';
import { RedisService } from '../../redis';
import {
  TmdbMovieDetails,
  TmdbSearchMoviesResponse,
  TmdbService,
} from '../../tmdb';
import { TmdbCircuitOpenException } from '../../tmdb/tmdb-circuit-open.exception';
import { SearchMoviesQueryDto } from './dto/search-movies-query.dto';
import { SearchMoviesResponseDto } from './dto/search-movies-response.dto';
import { mapTmdbSearchToResponse } from './mappers/search-movies.mapper';
import {
  buildMoviesSearchCacheKey,
  MOVIES_SEARCH_CACHE_TTL_SECONDS,
} from './movies.constants';

@Injectable()
export class MovieService {
  constructor(
    @InjectPinoLogger(MovieService.name)
    private readonly logger: PinoLogger,
    private readonly favoriteRepository: FavoriteRepository,
    private readonly redis: RedisService,
    private readonly tmdb: TmdbService,
  ) {}

  async listFavorites(): Promise<FavoriteMovieResponseDto[]> {
    const startTime = performance.now();

    this.logger.info('Listing favorites');

    const favorites = await this.favoriteRepository.findAll();

    const enrichedFavorites = await Promise.all(
      favorites.map((favorite) => this.enrichFavoriteWithTmdb(favorite)),
    );

    const responseTimeMs = Math.round(performance.now() - startTime);

    this.logger.info(
      { count: favorites.length, responseTimeMs },
      'Favorites listed',
    );

    return enrichedFavorites;
  }

  async addFavorite(
    dto: CreateFavoriteDto,
  ): Promise<FavoriteMovieResponseDto> {
    const { tmdbId } = dto;

    this.logger.info({ tmdbId }, 'Adding movie to favorites');

    const existingFavorite =
      await this.favoriteRepository.findByTmdbId(tmdbId);

    if (existingFavorite) {
      this.logger.warn({ tmdbId }, 'Movie is already in favorites');

      throw new MovieAlreadyFavoritedException();
    }

    const tmdbMovie = await this.fetchMovieFromTmdb(tmdbId);
    const snapshot = mapTmdbMovieToFavoriteSnapshot(tmdbMovie);
    const favorite = await this.favoriteRepository.create(snapshot);

    this.logger.info(
      { tmdbId, favoriteId: favorite.id },
      'Movie added to favorites',
    );

    return mapFavoriteToResponse(favorite);
  }

  async markAsWatched(tmdbId: number): Promise<FavoriteMovieResponseDto> {
    this.logger.info({ tmdbId }, 'Marking favorite as watched');

    const favorite = await this.favoriteRepository.findByTmdbId(tmdbId);

    if (!favorite) {
      this.logger.warn({ tmdbId }, 'Favorite not found');

      throw new MovieNotFoundException(tmdbId);
    }

    if (favorite.watched) {
      this.logger.info(
        { tmdbId, watchedAt: favorite.watchedAt },
        'Favorite is already marked as watched',
      );

      return mapFavoriteToResponse(favorite);
    }

    const updatedFavorite = await this.favoriteRepository.update(tmdbId, {
      watched: true,
      watchedAt: new Date(),
    });

    this.logger.info(
      { tmdbId, watchedAt: updatedFavorite.watchedAt },
      'Favorite marked as watched',
    );

    return mapFavoriteToResponse(updatedFavorite);
  }

  async updateRating(
    tmdbId: number,
    dto: UpdateFavoriteRatingDto,
  ): Promise<FavoriteMovieResponseDto> {
    this.logger.info({ tmdbId, rating: dto.rating }, 'Updating favorite rating');

    const favorite = await this.favoriteRepository.findByTmdbId(tmdbId);

    if (!favorite) {
      this.logger.warn({ tmdbId }, 'Favorite not found');

      throw new MovieNotFoundException(tmdbId);
    }

    if (!favorite.watched) {
      this.logger.warn(
        { tmdbId },
        'Cannot rate favorite that has not been watched',
      );

      throw new MovieNotWatchedException();
    }

    const updatedFavorite = await this.favoriteRepository.update(tmdbId, {
      rating: dto.rating,
    });

    this.logger.info(
      { tmdbId, rating: updatedFavorite.rating },
      'Favorite rating updated',
    );

    return mapFavoriteToResponse(updatedFavorite);
  }

  async search(query: SearchMoviesQueryDto): Promise<SearchMoviesResponseDto> {
    const page = query.page ?? 1;
    const cacheKey = buildMoviesSearchCacheKey(query.query, page);

    this.logger.info(
      { query: query.query, page, cacheKey },
      'Searching movies',
    );

    const cachedResponse = await this.getCachedSearch(cacheKey);

    if (cachedResponse) {
      this.logger.info(
        { event: LogEvent.CACHE_HIT, cacheKey },
        'cache hit',
      );
      return this.enrichWithFavorites(cachedResponse);
    }

    this.logger.info(
      { event: LogEvent.CACHE_MISS, cacheKey },
      'cache miss',
    );

    const tmdbResponse = await this.fetchSearchFromTmdb(query.query, page);
    const simplifiedResponse = mapTmdbSearchToResponse(tmdbResponse);

    await this.cacheSearch(cacheKey, simplifiedResponse);

    return this.enrichWithFavorites(simplifiedResponse);
  }

  private async enrichFavoriteWithTmdb(
    favorite: FavoriteMovie,
  ): Promise<FavoriteMovieResponseDto> {
    const cacheKey = buildFavoriteTmdbCacheKey(favorite.tmdbId);
    const cachedSnapshot = await this.getCachedTmdbSnapshot(cacheKey);

    if (cachedSnapshot) {
      this.logger.info(
        { event: LogEvent.CACHE_HIT, tmdbId: favorite.tmdbId, cacheKey },
        'cache hit',
      );

      return mergeFavoriteWithTmdbSnapshot(favorite, cachedSnapshot);
    }

    this.logger.info(
      { event: LogEvent.CACHE_MISS, tmdbId: favorite.tmdbId, cacheKey },
      'cache miss',
    );

    const tmdbMovie = await this.fetchTmdbSnapshotForEnrichment(
      favorite.tmdbId,
    );

    if (tmdbMovie) {
      await this.cacheTmdbSnapshot(cacheKey, tmdbMovie);

      return mergeFavoriteWithTmdbSnapshot(favorite, tmdbMovie);
    }

    this.logger.warn(
      { event: LogEvent.FALLBACK, tmdbId: favorite.tmdbId, reason: 'tmdb_unavailable' },
      'fallback',
    );

    return mapFavoriteToResponse(favorite);
  }

  private async getCachedTmdbSnapshot(
    cacheKey: string,
  ): Promise<TmdbMovieSnapshot | null> {
    try {
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as TmdbMovieSnapshot;
    } catch (error) {
      this.logger.warn(
        {
          event: LogEvent.FALLBACK,
          cacheKey,
          reason: 'cache_read_failed',
          err: error instanceof Error ? error.message : String(error),
        },
        'fallback',
      );

      return null;
    }
  }

  private async cacheTmdbSnapshot(
    cacheKey: string,
    snapshot: TmdbMovieSnapshot,
  ): Promise<void> {
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(snapshot),
        FAVORITE_TMDB_CACHE_TTL_SECONDS,
      );

      this.logger.info(
        { cacheKey, ttlSeconds: FAVORITE_TMDB_CACHE_TTL_SECONDS },
        'Cached TMDB data for favorite',
      );
    } catch (error) {
      this.logger.warn(
        {
          event: LogEvent.ERROR,
          cacheKey,
          err: error instanceof Error ? error.message : String(error),
        },
        'error',
      );
    }
  }

  private async fetchTmdbSnapshotForEnrichment(
    tmdbId: number,
  ): Promise<TmdbMovieSnapshot | null> {
    try {
      const tmdbMovie = await this.tmdb.getMovie(tmdbId);

      return mapTmdbMovieToSnapshot(tmdbMovie);
    } catch (error) {
      const isCircuitOpen = error instanceof TmdbCircuitOpenException;
      const status =
        error instanceof AxiosError ? error.response?.status : undefined;

      this.logger.warn(
        {
          event: LogEvent.FALLBACK,
          tmdbId,
          reason: isCircuitOpen ? 'circuit_open' : 'tmdb_error',
          status: isCircuitOpen ? 'circuit_open' : (status ?? 'unknown'),
          err: error instanceof Error ? error.message : String(error),
        },
        'fallback',
      );

      return null;
    }
  }

  private async getCachedSearch(
    cacheKey: string,
  ): Promise<SearchMoviesResponseDto | null> {
    try {
      const cached = await this.redis.get(cacheKey);

      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as SearchMoviesResponseDto;
    } catch (error) {
      this.logger.warn(
        {
          event: LogEvent.FALLBACK,
          cacheKey,
          reason: 'cache_read_failed',
          err: error instanceof Error ? error.message : String(error),
        },
        'fallback',
      );

      return null;
    }
  }

  private async cacheSearch(
    cacheKey: string,
    response: SearchMoviesResponseDto,
  ): Promise<void> {
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(response),
        MOVIES_SEARCH_CACHE_TTL_SECONDS,
      );

      this.logger.info(
        { cacheKey, ttlSeconds: MOVIES_SEARCH_CACHE_TTL_SECONDS },
        'Cached search result',
      );
    } catch (error) {
      this.logger.warn(
        {
          event: LogEvent.ERROR,
          cacheKey,
          err: error instanceof Error ? error.message : String(error),
        },
        'error',
      );
    }
  }

  private async fetchSearchFromTmdb(
    query: string,
    page: number,
  ): Promise<TmdbSearchMoviesResponse> {
    try {
      return await this.tmdb.searchMovies(query, page);
    } catch (error) {
      this.handleTmdbError(error);
    }
  }

  private async fetchMovieFromTmdb(tmdbId: number): Promise<TmdbMovieDetails> {
    try {
      return await this.tmdb.getMovie(tmdbId);
    } catch (error) {
      this.handleTmdbGetMovieError(error, tmdbId);
    }
  }

  private handleTmdbGetMovieError(error: unknown, tmdbId: number): never {
    if (error instanceof TmdbCircuitOpenException) {
      this.logger.warn(
        { event: LogEvent.FALLBACK, tmdbId, reason: 'circuit_open' },
        'fallback',
      );

      throw new BadGatewayException('Failed to fetch movie from TMDB');
    }

    if (error instanceof AxiosError) {
      const status = error.response?.status;

      this.logger.error(
        {
          event: LogEvent.ERROR,
          tmdbId,
          status: status ?? 'unknown',
          err: error.message,
        },
        'error',
      );

      if (status === 404) {
        throw new MovieNotFoundException(tmdbId, 'tmdb');
      }

      if (status === 401) {
        throw new InternalServerErrorException('TMDB API key is invalid');
      }

      throw new BadGatewayException('Failed to fetch movie from TMDB');
    }

    this.logger.error(
      {
        event: LogEvent.ERROR,
        tmdbId,
        err: error instanceof Error ? error.message : String(error),
      },
      'error',
    );

    throw new InternalServerErrorException('Failed to fetch movie');
  }

  private handleTmdbError(error: unknown): never {
    if (error instanceof TmdbCircuitOpenException) {
      this.logger.warn(
        { event: LogEvent.FALLBACK, reason: 'circuit_open' },
        'fallback',
      );

      throw new BadGatewayException('Failed to fetch movies from TMDB');
    }

    if (error instanceof AxiosError) {
      const status = error.response?.status;

      this.logger.error(
        {
          event: LogEvent.ERROR,
          status: status ?? 'unknown',
          err: error.message,
        },
        'error',
      );

      if (status === 401) {
        throw new InternalServerErrorException('TMDB API key is invalid');
      }

      throw new BadGatewayException('Failed to fetch movies from TMDB');
    }

    this.logger.error(
      {
        event: LogEvent.ERROR,
        err: error instanceof Error ? error.message : String(error),
      },
      'error',
    );

    throw new InternalServerErrorException('Failed to fetch movies');
  }

  private async enrichWithFavorites(
    response: SearchMoviesResponseDto,
  ): Promise<SearchMoviesResponseDto> {
    const favoriteIds = await this.getFavoriteTmdbIds();

    return {
      ...response,
      results: response.results.map((movie) => ({
        ...movie,
        isFavorite: favoriteIds.has(movie.tmdbId),
      })),
    };
  }

  private async getFavoriteTmdbIds(): Promise<Set<number>> {
    try {
      const favorites = await this.favoriteRepository.findAll();

      return new Set(favorites.map((favorite) => favorite.tmdbId));
    } catch (error) {
      this.logger.warn(
        {
          event: LogEvent.FALLBACK,
          reason: 'favorites_load_failed',
          err: error instanceof Error ? error.message : String(error),
        },
        'fallback',
      );

      return new Set();
    }
  }
}
