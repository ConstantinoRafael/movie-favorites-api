import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class MovieNotFoundException extends DomainException {
  constructor(tmdbId: number, source: 'favorite' | 'tmdb' = 'favorite') {
    const message =
      source === 'tmdb'
        ? `Movie with TMDB id ${tmdbId} not found`
        : `Favorite with TMDB id ${tmdbId} not found`;

    super(message, HttpStatus.NOT_FOUND);
  }
}
