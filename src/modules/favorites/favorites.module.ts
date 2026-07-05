import { forwardRef, Module } from '@nestjs/common';
import { MoviesModule } from '../movies/movies.module';
import { FavoriteController } from './favorite.controller';
import { FavoriteRepository } from './favorite.repository';

@Module({
  imports: [forwardRef(() => MoviesModule)],
  controllers: [FavoriteController],
  providers: [FavoriteRepository],
  exports: [FavoriteRepository],
})
export class FavoritesModule {}
