import { FavoriteMovie } from '@prisma/client';
import { TmdbMovieDetails } from '../../../tmdb/interfaces';
import { FavoriteMovieResponseDto } from '../dto/favorite-movie-response.dto';

const extractReleaseYear = (releaseDate: string): number => {
  if (!releaseDate) {
    return 0;
  }

  const year = Number.parseInt(releaseDate.split('-')[0] ?? '', 10);

  return Number.isNaN(year) ? 0 : year;
};

export const mapTmdbMovieToFavoriteSnapshot = (movie: TmdbMovieDetails) => ({
  tmdbId: movie.id,
  title: movie.title,
  overview: movie.overview,
  releaseYear: extractReleaseYear(movie.release_date),
  posterPath: movie.poster_path,
  voteAverage: movie.vote_average,
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
