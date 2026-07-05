import { Test, TestingModule } from '@nestjs/testing';
import { FavoriteController } from './favorite.controller';
import { MovieService } from '../movies/movie.service';
import { FavoriteMovieResponseDto } from './dto/favorite-movie-response.dto';

describe('FavoriteController', () => {
  let controller: FavoriteController;
  let movieService: { addFavorite: jest.Mock };

  const mockFavoriteResponse: FavoriteMovieResponseDto = {
    id: 1,
    tmdbId: 550,
    title: 'Fight Club',
    overview: 'A ticking-time-bomb insomniac...',
    releaseYear: 1999,
    posterPath: '/poster.jpg',
    voteAverage: 8.4,
    watched: false,
    watchedAt: null,
    rating: null,
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    updatedAt: new Date('2026-01-01T12:00:00.000Z'),
  };

  beforeEach(async () => {
    movieService = {
      addFavorite: jest.fn().mockResolvedValue(mockFavoriteResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoriteController],
      providers: [{ provide: MovieService, useValue: movieService }],
    }).compile();

    controller = module.get<FavoriteController>(FavoriteController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate create to MovieService', async () => {
    const dto = { tmdbId: 550 };

    const result = await controller.create(dto);

    expect(result).toEqual(mockFavoriteResponse);
    expect(movieService.addFavorite).toHaveBeenCalledWith(dto);
  });
});
