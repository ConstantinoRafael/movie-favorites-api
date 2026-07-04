export interface TmdbMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
  status: string;
}
