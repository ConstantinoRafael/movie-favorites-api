import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { RedisModule } from '../../redis';
import { TmdbModule } from '../../tmdb';
import { FavoriteController } from './favorite.controller';
import { FavoriteRepository } from './favorite.repository';
import { FavoriteService } from './favorite.service';

@Module({
  imports: [TmdbModule, RedisModule, LoggerModule],
  controllers: [FavoriteController],
  providers: [FavoriteRepository, FavoriteService],
  exports: [FavoriteRepository],
})
export class FavoritesModule {}
