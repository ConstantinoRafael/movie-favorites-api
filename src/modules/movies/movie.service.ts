import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { LogEvent } from '@common/logging';
import { getErrorMessage } from '@common/utils';
import { FavoriteRepository } from '../favorites/favorite.repository';
import { RedisService } from '../../redis';
import { TmdbSearchMoviesResponse, TmdbService, TmdbErrorHandler } from '../../tmdb';
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
    private readonly tmdbErrorHandler: TmdbErrorHandler,
  ) {}

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
          err: getErrorMessage(error),
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
      this.logger.error(
        {
          event: LogEvent.ERROR,
          cacheKey,
          err: getErrorMessage(error),
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
      this.tmdbErrorHandler.handleFetchError(error, 'search');
    }
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
          err: getErrorMessage(error),
        },
        'fallback',
      );

      return new Set();
    }
  }
}
