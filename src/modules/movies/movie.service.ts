import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { FavoriteRepository } from '../favorites/favorite.repository';
import { RedisService } from '../../redis';
import { TmdbSearchMoviesResponse, TmdbService } from '../../tmdb';
import { SearchMoviesQueryDto } from './dto/search-movies-query.dto';
import { SearchMoviesResponseDto } from './dto/search-movies-response.dto';
import { mapTmdbSearchToResponse } from './mappers/search-movies.mapper';
import {
  buildMoviesSearchCacheKey,
  MOVIES_SEARCH_CACHE_TTL_SECONDS,
} from './movies.constants';

@Injectable()
export class MovieService {
  private readonly logger = new Logger(MovieService.name);

  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly redis: RedisService,
    private readonly tmdb: TmdbService,
  ) {}

  async search(query: SearchMoviesQueryDto): Promise<SearchMoviesResponseDto> {
    const page = query.page ?? 1;
    const cacheKey = buildMoviesSearchCacheKey(query.query, page);

    this.logger.log(
      `Searching movies: query="${query.query}", page=${page}, cacheKey="${cacheKey}"`,
    );

    const cachedResponse = await this.getCachedSearch(cacheKey);

    if (cachedResponse) {
      this.logger.log(`Cache hit for key="${cacheKey}"`);
      return this.enrichWithFavorites(cachedResponse);
    }

    this.logger.log(`Cache miss for key="${cacheKey}"`);

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
        `Failed to read cache for key="${cacheKey}". Falling back to TMDB.`,
        error instanceof Error ? error.stack : String(error),
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

      this.logger.log(
        `Cached search result for key="${cacheKey}" with TTL=${MOVIES_SEARCH_CACHE_TTL_SECONDS}s`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to write cache for key="${cacheKey}". Returning response without caching.`,
        error instanceof Error ? error.stack : String(error),
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

  private handleTmdbError(error: unknown): never {
    if (error instanceof AxiosError) {
      const status = error.response?.status;

      this.logger.error(
        `TMDB API error: status=${status ?? 'unknown'} message=${error.message}`,
        error.stack,
      );

      if (status === 401) {
        throw new InternalServerErrorException('TMDB API key is invalid');
      }

      throw new BadGatewayException('Failed to fetch movies from TMDB');
    }

    this.logger.error(
      'Unexpected error while fetching movies from TMDB',
      error instanceof Error ? error.stack : String(error),
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
        'Failed to load favorites for search enrichment. Returning without isFavorite.',
        error instanceof Error ? error.stack : String(error),
      );

      return new Set();
    }
  }
}
