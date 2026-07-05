import { Test, TestingModule } from '@nestjs/testing';
import { FavoriteController } from './favorite.controller';
import { MovieService } from '../movies/movie.service';
import { FavoriteMovieResponseDto } from './dto/favorite-movie-response.dto';

describe('FavoriteController', () => {
  let controller: FavoriteController;
  let movieService: {
    addFavorite: jest.Mock;
    listFavorites: jest.Mock;
    markAsWatched: jest.Mock;
    updateRating: jest.Mock;
  };

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
      listFavorites: jest.fn().mockResolvedValue([mockFavoriteResponse]),
      markAsWatched: jest.fn().mockResolvedValue({
        ...mockFavoriteResponse,
        watched: true,
        watchedAt: new Date('2026-01-15T20:30:00.000Z'),
      }),
      updateRating: jest.fn().mockResolvedValue({
        ...mockFavoriteResponse,
        watched: true,
        rating: 8.5,
      }),
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

  it('should delegate findAll to MovieService', async () => {
    const result = await controller.findAll();

    expect(result).toEqual([mockFavoriteResponse]);
    expect(movieService.listFavorites).toHaveBeenCalled();
  });

  it('should delegate markAsWatched to MovieService', async () => {
    const params = { tmdbId: 550 };

    const result = await controller.markAsWatched(params);

    expect(result.watched).toBe(true);
    expect(movieService.markAsWatched).toHaveBeenCalledWith(550);
  });

  it('should delegate updateRating to MovieService', async () => {
    const params = { tmdbId: 550 };
    const dto = { rating: 8.5 };

    const result = await controller.updateRating(params, dto);

    expect(result.rating).toBe(8.5);
    expect(movieService.updateRating).toHaveBeenCalledWith(550, dto);
  });
});
