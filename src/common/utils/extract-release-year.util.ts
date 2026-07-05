export const extractReleaseYear = (releaseDate: string): number => {
  if (!releaseDate) {
    return 0;
  }

  const year = Number.parseInt(releaseDate.split('-')[0] ?? '', 10);

  return Number.isNaN(year) ? 0 : year;
};
