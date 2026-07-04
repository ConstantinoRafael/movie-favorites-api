export const MOVIES_SEARCH_CACHE_TTL_SECONDS = 3600;

export const buildMoviesSearchCacheKey = (
  query: string,
  page: number,
): string => `movies:search:${query.toLowerCase().trim()}:${page}`;
