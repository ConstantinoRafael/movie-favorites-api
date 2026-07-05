export const tmdbMovieDetails = {
  id: 550,
  title: 'Fight Club',
  overview: 'A ticking-time-bomb insomniac...',
  poster_path: '/poster.jpg',
  release_date: '1999-10-15',
  vote_average: 8.4,
  runtime: 139,
  genres: [{ id: 18, name: 'Drama' }],
  status: 'Released',
};

export const createdFavorite = {
  id: 1,
  tmdbId: 550,
  title: 'Fight Club',
  overview: 'A ticking-time-bomb insomniac...',
  releaseYear: 1999,
  posterPath: '/poster.jpg',
  voteAverage: 8.4,
  watched: false,
  watchedAt: null,
  rating: null,
  createdAt: new Date('2026-01-01T12:00:00.000Z'),
  updatedAt: new Date('2026-01-01T12:00:00.000Z'),
};

export const watchedFavorite = {
  ...createdFavorite,
  watched: true,
  watchedAt: new Date('2026-01-15T20:30:00.000Z'),
  rating: 8.5,
};
