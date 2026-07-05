import { FavoriteMovie } from '@prisma/client';
import { extractReleaseYear } from '@common/utils';
import { TmdbMovieDetails } from '../../../tmdb/interfaces';
import { FavoriteMovieResponseDto } from '../dto/favorite-movie-response.dto';

export type TmdbMovieSnapshot = {
  title: string;
  overview: string;
  releaseYear: number;
  posterPath: string | null;
  voteAverage: number;
};

export const mapTmdbMovieToSnapshot = (
  movie: TmdbMovieDetails,
): TmdbMovieSnapshot => ({
  title: movie.title,
  overview: movie.overview,
  releaseYear: extractReleaseYear(movie.release_date),
  posterPath: movie.poster_path,
  voteAverage: movie.vote_average,
});

export const mapTmdbMovieToFavoriteSnapshot = (movie: TmdbMovieDetails) => ({
  tmdbId: movie.id,
  ...mapTmdbMovieToSnapshot(movie),
});

export const mergeFavoriteWithTmdbSnapshot = (
  favorite: FavoriteMovie,
  snapshot: TmdbMovieSnapshot,
): FavoriteMovieResponseDto => ({
  ...mapFavoriteToResponse(favorite),
  title: snapshot.title,
  overview: snapshot.overview,
  releaseYear: snapshot.releaseYear,
  posterPath: snapshot.posterPath,
  voteAverage: snapshot.voteAverage,
});

export const mapFavoriteToResponse = (
  favorite: FavoriteMovie,
): FavoriteMovieResponseDto => ({
  id: favorite.id,
  tmdbId: favorite.tmdbId,
  title: favorite.title,
  overview: favorite.overview,
  releaseYear: favorite.releaseYear,
  posterPath: favorite.posterPath,
  voteAverage: favorite.voteAverage,
  watched: favorite.watched,
  watchedAt: favorite.watchedAt,
  rating: favorite.rating,
  createdAt: favorite.createdAt,
  updatedAt: favorite.updatedAt,
});
