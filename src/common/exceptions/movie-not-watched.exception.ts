import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class MovieNotWatchedException extends DomainException {
  constructor() {
    super(
      'Favorite must be marked as watched before rating',
      HttpStatus.BAD_REQUEST,
    );
  }
}
