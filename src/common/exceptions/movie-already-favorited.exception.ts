import { HttpStatus } from '@nestjs/common';
import { DomainException } from './domain.exception';

export class MovieAlreadyFavoritedException extends DomainException {
  constructor() {
    super('Movie is already in favorites', HttpStatus.CONFLICT);
  }
}
