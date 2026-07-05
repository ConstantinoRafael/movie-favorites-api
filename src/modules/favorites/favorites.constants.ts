export const FAVORITE_TMDB_CACHE_TTL_SECONDS = 3600;

export const buildFavoriteTmdbCacheKey = (tmdbId: number): string =>
  `favorites:tmdb:${tmdbId}`;
