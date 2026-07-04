import { Module } from '@nestjs/common';
import { RedisModule } from '../../redis';
import { TmdbModule } from '../../tmdb';
import { FavoritesModule } from '../favorites/favorites.module';
import { MovieController } from './movie.controller';
import { MovieService } from './movie.service';

@Module({
  imports: [FavoritesModule, RedisModule, TmdbModule],
  controllers: [MovieController],
  providers: [MovieService],
  exports: [MovieService],
})
export class MoviesModule {}
