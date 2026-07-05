import { extractReleaseYear } from '@common/utils';
import {
  TmdbMovieSummary,
  TmdbSearchMoviesResponse,
} from '../../../tmdb/interfaces';
import { SearchMoviesResponseDto } from '../dto/search-movies-response.dto';
import { MovieSummaryResponseDto } from '../dto/movie-summary-response.dto';

export const mapTmdbMovieToSummary = (
  movie: TmdbMovieSummary,
): MovieSummaryResponseDto => ({
  tmdbId: movie.id,
  title: movie.title,
  overview: movie.overview,
  posterPath: movie.poster_path,
  releaseYear: extractReleaseYear(movie.release_date),
  voteAverage: movie.vote_average,
});

export const mapTmdbSearchToResponse = (
  response: TmdbSearchMoviesResponse,
): SearchMoviesResponseDto => ({
  page: response.page,
  totalPages: response.total_pages,
  totalResults: response.total_results,
  results: response.results.map(mapTmdbMovieToSummary),
});
