import { Injectable } from '@nestjs/common';
import { FavoriteRepository } from '../favorites/favorite.repository';
import { RedisService } from '../../redis';
import { TmdbService } from '../../tmdb';

@Injectable()
export class MovieService {
  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly redis: RedisService,
    private readonly tmdb: TmdbService,
  ) {}
}
