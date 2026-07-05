import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { RedisModule } from '../../redis';
import { TmdbModule } from '../../tmdb';
import { FavoritesModule } from '../favorites/favorites.module';
import { MovieController } from './movie.controller';
import { MovieService } from './movie.service';

@Module({
  imports: [FavoritesModule, RedisModule, TmdbModule, LoggerModule],
  controllers: [MovieController],
  providers: [MovieService],
})
export class MoviesModule {}
