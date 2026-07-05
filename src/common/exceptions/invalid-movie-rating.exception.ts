import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class InvalidMovieRatingException extends DomainException {
  constructor(
    message = 'Rating must be a number between 0 and 10 with up to 2 decimal places',
  ) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
