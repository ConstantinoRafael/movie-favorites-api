import { Injectable } from '@nestjs/common';
import { FavoriteMovie } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  MovieAlreadyFavoritedException,
  MovieNotFoundException,
  MovieNotWatchedException,
} from '@common/exceptions';
import { LogEvent } from '@common/logging';
import { getErrorMessage } from '@common/utils';
import { RedisService } from '../../redis';
import { TmdbMovieDetails, TmdbService, TmdbErrorHandler } from '../../tmdb';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoriteMovieResponseDto } from './dto/favorite-movie-response.dto';
import { UpdateFavoriteRatingDto } from './dto/update-favorite-rating.dto';
import { FavoriteRepository } from './favorite.repository';
import {
  buildFavoriteTmdbCacheKey,
  FAVORITE_TMDB_CACHE_TTL_SECONDS,
} from './favorites.constants';
import {
  mapFavoriteToResponse,
  mapTmdbMovieToFavoriteSnapshot,
  mapTmdbMovieToSnapshot,
  mergeFavoriteWithTmdbSnapshot,
  TmdbMovieSnapshot,
} from './mappers/favorite-movie.mapper';

@Injectable()
export class FavoriteService {
  constructor(
    @InjectPinoLogger(FavoriteService.name)
    private readonly logger: PinoLogger,
    private readonly favoriteRepository: FavoriteRepository,
    private readonly redis: RedisService,
    private readonly tmdb: TmdbService,
    private readonly tmdbErrorHandler: TmdbErrorHandler,
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
      {
        event: LogEvent.FALLBACK,
        tmdbId: favorite.tmdbId,
        reason: 'tmdb_unavailable',
      },
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
          err: getErrorMessage(error),
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

  private async fetchTmdbSnapshotForEnrichment(
    tmdbId: number,
  ): Promise<TmdbMovieSnapshot | null> {
    try {
      const tmdbMovie = await this.tmdb.getMovie(tmdbId);

      return mapTmdbMovieToSnapshot(tmdbMovie);
    } catch (error) {
      this.tmdbErrorHandler.logEnrichmentFailure(error, tmdbId);

      return null;
    }
  }

  private async fetchMovieFromTmdb(tmdbId: number): Promise<TmdbMovieDetails> {
    try {
      return await this.tmdb.getMovie(tmdbId);
    } catch (error) {
      this.tmdbErrorHandler.handleFetchError(error, 'getMovie', tmdbId);
    }
  }
}
