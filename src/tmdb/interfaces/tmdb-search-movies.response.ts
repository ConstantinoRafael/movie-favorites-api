export interface TmdbMovieSummary {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
}

export interface TmdbSearchMoviesResponse {
  page: number;
  results: TmdbMovieSummary[];
  total_pages: number;
  total_results: number;
}
