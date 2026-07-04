import { Module } from '@nestjs/common';
import { FavoriteRepository } from './favorite.repository';

@Module({
  providers: [FavoriteRepository],
  exports: [FavoriteRepository],
})
export class FavoritesModule {}
